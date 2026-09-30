import { BadRequestException, Injectable, PayloadTooLargeException, ServiceUnavailableException } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { v4 as uuid } from 'uuid';
import { AUDIO_MAX_BYTES, UPLOAD_ROOT, VIDEO_MAX_BYTES } from '../../common/constants/upload';
import {
  DEFAULT_ROADSHOW_MEDIA_NAME_TEMPLATE,
  ObjectStorageConfigService,
} from './object-storage-config.service';

export type UploadScope = 'roadshow-audio' | 'roadshow-review-video';

export interface UploadContext {
  sessionId?: number;
  registrationId?: number;
}

/**
 * 计算路演素材在对象存储中的目录（不含 keyPrefix）。
 * 直传签发（createDirectUpload）与完成校验（confirmDirectUpload）必须共用此函数，
 * 保证 object_key 与票据目录严格绑定（纵深防御，含 registrationId 细分）。
 */
export function buildRoadshowObjectDirectory(scope: UploadScope, context: UploadContext): string {
  const typeSegment = scope === 'roadshow-audio' ? 'audio' : 'review-videos';
  if (!context.sessionId) return `roadshow/unassigned/${typeSegment}`;
  if (context.registrationId) {
    return `roadshow/sessions/${context.sessionId}/registrations/${context.registrationId}/${typeSegment}`;
  }
  return `roadshow/sessions/${context.sessionId}/${typeSegment}`;
}

export interface RoadshowMediaNamingContext {
  registrationId: number;
  songName: string;
  groupName: string;
  artistName: string;
  sessionId: number;
  sessionName?: string;
  mediaType: 'audio' | 'review-video';
}

export type ObjectReadAvailability = 'available' | 'missing' | 'unmanaged';

export interface ObjectReadAccess {
  url: string | null;
  availability: ObjectReadAvailability;
}

@Injectable()
export class ObjectStorageService {
  constructor(private readonly configService: ObjectStorageConfigService) {}

  async upload(
    file: Express.Multer.File,
    scope: UploadScope,
    context: UploadContext = {},
  ): Promise<string> {
    const maxBytes = scope === 'roadshow-audio' ? AUDIO_MAX_BYTES : VIDEO_MAX_BYTES;
    if (file.size > maxBytes) {
      throw new PayloadTooLargeException(
        scope === 'roadshow-audio' ? '音频不能超过 30MB' : '审核视频不能超过 1GB',
      );
    }
    const extension = extname(file.originalname).toLowerCase();
    const fileName = `${uuid()}${extension}`;
    if (!(await this.configService.isEnabled())) {
      return this.saveLocally(file.buffer, fileName);
    }

    const config = await this.configService.getRuntimeConfig();
    const directory = this.resolveObjectDirectory(scope, context);
    const key = [config.keyPrefix, directory, fileName].filter(Boolean).join('/');
    try {
      await this.configService.createClient(config).putObject({
        bucket: config.bucket,
        key,
        body: file.buffer,
        contentLength: file.size,
        contentType: file.mimetype,
      });
      return this.configService.buildPublicUrl(config, key);
    } catch (error) {
      throw new ServiceUnavailableException(
        `对象存储上传失败：${error instanceof Error ? error.message : '未知错误'}`,
      );
    }
  }

  async isEnabled(): Promise<boolean> {
    return this.configService.isEnabled();
  }

  async isManagedUrl(url: string): Promise<boolean> {
    if (/^\/uploads\/[A-Za-z0-9._-]+$/.test(url)) return true;
    try {
      return Boolean(await this.resolveManagedObject(url));
    } catch {
      return false;
    }
  }

  async deleteManagedObject(url: string): Promise<boolean> {
    const resolved = await this.resolveManagedObject(url);
    if (!resolved) return false;
    await this.configService.createClient(resolved.config).deleteObject({
      bucket: resolved.config.bucket,
      key: resolved.key,
    });
    return true;
  }

  async createDirectUpload(
    originalName: string,
    contentType: string,
    scope: 'roadshow-audio' | 'roadshow-review-video',
    context: UploadContext,
    namingContext?: RoadshowMediaNamingContext,
  ) {
    const config = await this.configService.getRuntimeConfig();
    const extension = extname(originalName).toLowerCase();
    const template = config.roadshowMediaNameTemplate || DEFAULT_ROADSHOW_MEDIA_NAME_TEMPLATE;
    const hasRandomVariable = /\{random\}|\{随机编号\}/.test(template);
    const readableStem = namingContext
      ? this.renderRoadshowMediaName(template, namingContext)
      : this.sanitizeObjectName(originalName.slice(0, -extension.length));
    const uniqueSuffix = hasRandomVariable ? '' : `_${uuid().slice(0, 8)}`;
    const fileName = `${readableStem}${uniqueSuffix}${extension}`;
    const directory = this.resolveObjectDirectory(scope, context);
    const key = [config.keyPrefix, directory, fileName].filter(Boolean).join('/');
    const client = this.configService.createClient(config);
    return {
      objectKey: key,
      objectUrl: this.configService.buildPublicUrl(config, key),
      uploadUrl: client.getPreSignedUrl({
        bucket: config.bucket,
        key,
        method: 'PUT',
        expires: 30 * 60,
      }),
      headers: { 'Content-Type': contentType },
      expiresIn: 30 * 60,
    };
  }

  async confirmDirectUpload(objectKey: string, expectedDirectory: string, maxBytes: number) {
    const config = await this.configService.getRuntimeConfig();
    const normalizedPrefix = config.keyPrefix ? `${config.keyPrefix.replace(/\/+$/, '')}/` : '';
    const requiredPrefix = `${normalizedPrefix}${expectedDirectory.replace(/^\/+|\/+$/g, '')}/`;
    if (!objectKey.startsWith(requiredPrefix) || objectKey.includes('..')) {
      throw new BadRequestException('对象路径与当前报名不匹配');
    }
    let head;
    try {
      head = await this.configService.createClient(config).headObject({
        bucket: config.bucket,
        key: objectKey,
      });
    } catch (error) {
      const statusCode = Number(
        (error as { statusCode?: number; status?: number })?.statusCode ??
          (error as { status?: number })?.status,
      );
      if (statusCode === 404) {
        throw new BadRequestException('上传对象不存在或已被清理，请重新上传');
      }
      throw error;
    }
    const size = Number(head.data['content-length']);
    if (!Number.isFinite(size) || size <= 0 || size > maxBytes) {
      try {
        await this.configService.createClient(config).deleteObject({ bucket: config.bucket, key: objectKey });
      } catch {
        /* 清理失败不阻断校验结果 */
      }
      throw new BadRequestException('上传对象大小无效或超过限制，已删除');
    }
    return {
      url: this.configService.buildPublicUrl(config, objectKey),
      size,
    };
  }

  async createReadAccess(
    url: string | null | undefined,
    downloadName?: string,
  ): Promise<ObjectReadAccess> {
    if (!url) return { url: null, availability: 'unmanaged' };
    if (url.startsWith('/uploads/')) return { url, availability: 'unmanaged' };
    let resolved;
    try {
      resolved = await this.resolveManagedObject(url);
    } catch {
      // TOS 配置缺失/不完整时优雅降级为非托管，避免 GET media 整体 400。
      return { url: null, availability: 'unmanaged' };
    }
    if (!resolved) return { url: null, availability: 'unmanaged' };
    const client = this.configService.createClient(resolved.config);
    try {
      await client.headObject({
        bucket: resolved.config.bucket,
        key: resolved.key,
      });
    } catch (error) {
      if (this.isObjectMissingError(error)) {
        return { url: null, availability: 'missing' };
      }
      throw error;
    }
    return {
      availability: 'available',
      url: client.getPreSignedUrl({
        bucket: resolved.config.bucket,
        key: resolved.key,
        method: 'GET',
        expires: 60 * 60,
        response: downloadName
          ? { contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}` }
          : undefined,
      }),
    };
  }

  async createSignedReadUrl(url: string | null | undefined, downloadName?: string) {
    return (await this.createReadAccess(url, downloadName)).url;
  }

  async createSignedReadUrlUnchecked(
    url: string | null | undefined,
    downloadName?: string,
  ) {
    if (!url) return null;
    if (url.startsWith('/uploads/')) return url;
    let resolved;
    try {
      resolved = await this.resolveManagedObject(url);
    } catch {
      // TOS 配置缺失/不完整时优雅降级为非托管。
      return null;
    }
    if (!resolved) return null;
    return this.configService.createClient(resolved.config).getPreSignedUrl({
      bucket: resolved.config.bucket,
      key: resolved.key,
      method: 'GET',
      expires: 60 * 60,
      response: downloadName
        ? { contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}` }
        : undefined,
    });
  }

  private async saveLocally(buffer: Buffer, fileName: string) {
    const directory = UPLOAD_ROOT;
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, fileName), buffer);
    return `/uploads/${fileName}`;
  }

  private resolveObjectDirectory(scope: UploadScope, context: UploadContext): string {
    return buildRoadshowObjectDirectory(scope, context);
  }

  private isObjectMissingError(error: unknown): boolean {
    const candidate = error as {
      statusCode?: number;
      status?: number;
      code?: string;
      message?: string;
    };
    const statusCode = Number(candidate?.statusCode ?? candidate?.status);
    return statusCode === 404
      || candidate?.code === 'NoSuchKey'
      || /NoSuchKey|not found/i.test(candidate?.message || '');
  }

  private renderRoadshowMediaName(
    template: string,
    context: RoadshowMediaNamingContext,
  ) {
    const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    const random = uuid().slice(0, 8);
    const values = new Map<string, string | number>([
      ['registrationNumber', context.registrationId],
      ['registrationId', context.registrationId],
      ['songName', context.songName],
      ['groupName', context.groupName],
      ['artistName', context.artistName],
      ['sessionId', context.sessionId],
      ['sessionName', context.sessionName || ''],
      ['mediaType', context.mediaType],
      ['mediaTypeName', context.mediaType === 'audio' ? '音频' : '审核视频'],
      ['timestamp', timestamp],
      ['random', random],
      ['报名序号', context.registrationId],
      ['报名ID', context.registrationId],
      ['歌曲名', context.songName],
      ['组名', context.groupName],
      ['歌手名', context.artistName],
      ['场次ID', context.sessionId],
      ['场次名', context.sessionName || ''],
      ['素材类型', context.mediaType],
      ['素材类型名', context.mediaType === 'audio' ? '音频' : '审核视频'],
      ['上传时间', timestamp],
      ['随机编号', random],
    ]);
    return this.sanitizeObjectName(
      template.replace(/\{([^{}]+)\}/g, (_, name: string) => String(values.get(name) ?? '')),
    );
  }

  private sanitizeObjectName(value: string) {
    const normalized = value
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N}._-]+/gu, '_')
      .replace(/_+/g, '_')
      .replace(/^[_\.]+|[_\.]+$/g, '')
      .slice(0, 140);
    return normalized || 'roadshow-media';
  }

  private async resolveManagedObject(url: string) {
    if (!/^https?:\/\//i.test(url)) return null;
    const config = await this.configService.getRuntimeConfig(false);
    const baseUrl = config.publicBaseUrl || `https://${config.bucket}.${config.endpoint}`;
    const normalizedBase = baseUrl.replace(/\/+$/, '');
    if (!url.startsWith(`${normalizedBase}/`)) return null;
    const key = decodeURIComponent(url.slice(normalizedBase.length + 1));
    const normalizedPrefix = config.keyPrefix.replace(/\/+$/, '');
    const requiredPrefix = normalizedPrefix ? `${normalizedPrefix}/` : '';
    if (
      (requiredPrefix && !key.startsWith(requiredPrefix)) ||
      (!requiredPrefix && !/^roadshow\//.test(key)) ||
      key.includes('..')
    ) return null;
    return { config, key };
  }
}
