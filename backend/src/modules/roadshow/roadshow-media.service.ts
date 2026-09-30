import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { extname } from 'path';
import { In, Repository } from 'typeorm';
import { AUDIO_MAX_BYTES, VIDEO_MAX_BYTES } from '../../common/constants/upload';
import { UserRole } from '../users/entities/user.entity';
import { buildRoadshowObjectDirectory, ObjectStorageService } from '../upload/object-storage.service';
import { RegistrationStatus, RoadshowRegistration } from './entities/roadshow-registration.entity';
import { CreateRoadshowMediaUploadDto } from './dto/roadshow-media.dto';

export type RoadshowMediaType = 'audio' | 'review-video';

export type RoadshowMediaStatus = 'not_submitted' | 'approved_without_upload' | 'submitted';

export function roadshowMediaStatus(
  enabled: boolean | number,
  uploaded: boolean,
): RoadshowMediaStatus {
  if (!enabled) return 'not_submitted';
  return uploaded ? 'submitted' : 'approved_without_upload';
}

export interface RoadshowMediaDownloadItem {
  registration_id: number;
  media_type: RoadshowMediaType;
  group_order: number | null;
  filename: string;
  download_url: string;
}

export interface RoadshowMediaUnavailableItem {
  registration_id: number;
  media_type: RoadshowMediaType;
  reason: 'missing' | 'unmanaged';
}

const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.wav', '.flac', '.aac', '.ogg']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.webm']);

@Injectable()
export class RoadshowMediaService {
  private readonly logger = new Logger(RoadshowMediaService.name);

  constructor(
    @InjectRepository(RoadshowRegistration)
    private readonly registrationRepo: Repository<RoadshowRegistration>,
    private readonly objectStorage: ObjectStorageService,
  ) {}

  /**
   * 视频上传门禁：对象存储（TOS）未启用时，审核视频一律拒绝（403）；音频不受影响。
   * 判定单点收敛于此，仅 type === 'review-video' 生效。
   */
  private async assertVideoUploadAllowed(type: RoadshowMediaType) {
    if (type === 'review-video' && !(await this.objectStorage.isEnabled())) {
      throw new ForbiddenException('对象存储未启用，暂不支持上传审核视频');
    }
  }

  async createUpload(
    registrationId: number,
    user: { id: number; role: UserRole },
    type: RoadshowMediaType,
    dto: CreateRoadshowMediaUploadDto,
  ) {
    await this.assertVideoUploadAllowed(type);
    const registration = await this.findAccessible(registrationId, user, true);
    const rule = this.validateFile(type, dto);
    // TOS 未启用时返回本地上传契约，前端据此改走 multipart 本地端点。
    if (!(await this.objectStorage.isEnabled())) {
      return { mode: 'local' as const, max_size: rule.maxBytes };
    }
    const scope = type === 'audio' ? 'roadshow-audio' : 'roadshow-review-video';
    const direct = await this.objectStorage.createDirectUpload(
      dto.file_name,
      dto.content_type,
      scope,
      { sessionId: registration.session_id, registrationId: registration.id },
      {
        registrationId: registration.id,
        songName: registration.song_name,
        groupName: registration.group_name,
        artistName: registration.artist_name,
        sessionId: registration.session_id,
        sessionName: registration.session?.name,
        mediaType: type,
      },
    );
    return {
      mode: 'direct' as const,
      method: 'PUT' as const,
      upload_url: direct.uploadUrl,
      object_key: direct.objectKey,
      headers: direct.headers,
      expires_in: direct.expiresIn,
      max_size: rule.maxBytes,
    };
  }

  async completeUpload(
    registrationId: number,
    user: { id: number; role: UserRole },
    type: RoadshowMediaType,
    objectKey: string,
  ) {
    await this.assertVideoUploadAllowed(type);
    const registration = await this.findAccessible(registrationId, user, true);
    const maxBytes = type === 'audio' ? AUDIO_MAX_BYTES : VIDEO_MAX_BYTES;
    const scope = type === 'audio' ? 'roadshow-audio' : 'roadshow-review-video';
    // 目录与签发票据严格绑定（含 registrationId），与 createDirectUpload 共用同一函数。
    const directory = buildRoadshowObjectDirectory(scope, {
      sessionId: registration.session_id,
      registrationId: registration.id,
    });
    const result = await this.objectStorage.confirmDirectUpload(objectKey, directory, maxBytes);
    const previousUrl = type === 'audio'
      ? registration.edited_file_url
      : registration.review_video_url;
    // 只写目标列，避免整实体 save() 回写陈旧 sort_order/status 等列造成丢失更新。
    const patch = type === 'audio'
      ? { edited_file_url: result.url, audio_enabled: 1, song_format: 1, song_format_manually_set: 0 }
      : { review_video_url: result.url, review_video_submitted: 1, review_video_enabled: 1 };
    await this.registrationRepo.update(registration.id, patch);
    Object.assign(registration, patch);
    if (previousUrl && previousUrl !== result.url) {
      try {
        await this.objectStorage.deleteManagedObject(previousUrl);
      } catch (error) {
        this.logger.warn(
          `清理报名 ${registration.id} 旧素材对象失败：${previousUrl}（${error instanceof Error ? error.message : error}）`,
        );
      }
    }
    return this.mediaState(registration);
  }

  /**
   * 本地 multipart 上传回退（仅 TOS 未启用时使用）。
   * 校验大小（audio 30MB / review-video 1GB）与本人权限（非 REJECTED），
   * 经 saveLocally 落盘并更新对应 registration 列，返回与 GET media 一致的 mediaState。
   */
  async uploadLocal(
    registrationId: number,
    user: { id: number; role: UserRole },
    type: RoadshowMediaType,
    file: Express.Multer.File,
  ) {
    // 视频门禁先于本地回退的反向判定，保证审核视频在 TOS 未启用时被 403 拦截。
    await this.assertVideoUploadAllowed(type);
    if (await this.objectStorage.isEnabled()) {
      throw new BadRequestException('对象存储已启用，请改用直传模式上传');
    }
    if (!file || !file.buffer || file.size <= 0) {
      throw new BadRequestException('文件上传失败');
    }
    const registration = await this.findAccessible(registrationId, user, true);
    const isAudio = type === 'audio';
    const maxBytes = isAudio ? AUDIO_MAX_BYTES : VIDEO_MAX_BYTES;
    const extensions = isAudio ? AUDIO_EXTENSIONS : VIDEO_EXTENSIONS;
    if (file.size > maxBytes) {
      throw new BadRequestException(isAudio ? '音频不能超过 30MB' : '审核视频不能超过 1GB');
    }
    if (!extensions.has(extname(file.originalname).toLowerCase())) {
      throw new BadRequestException(isAudio
        ? '音频仅支持 mp3、m4a、wav、flac、aac、ogg'
        : '视频仅支持 mp4、mov、m4v、webm');
    }
    const scope = isAudio ? 'roadshow-audio' : 'roadshow-review-video';
    const previousUrl = isAudio ? registration.edited_file_url : registration.review_video_url;
    // TOS 未启用，upload() 内部走 saveLocally 落盘到 UPLOAD_ROOT，返回 /uploads/... 。
    const url = await this.objectStorage.upload(file, scope, {
      sessionId: registration.session_id,
      registrationId: registration.id,
    });
    const patch = isAudio
      ? { edited_file_url: url, audio_enabled: 1, song_format: 1, song_format_manually_set: 0 }
      : { review_video_url: url, review_video_submitted: 1, review_video_enabled: 1 };
    await this.registrationRepo.update(registration.id, patch);
    Object.assign(registration, patch);
    if (previousUrl && previousUrl !== url) {
      try {
        await this.objectStorage.deleteManagedObject(previousUrl);
      } catch (error) {
        this.logger.warn(
          `清理报名 ${registration.id} 旧素材失败：${previousUrl}（${error instanceof Error ? error.message : error}）`,
        );
      }
    }
    return this.mediaState(registration);
  }

  /** 删除报名绑定的音频与审核视频对象；托管对象删除失败只记录日志，不阻断业务流程 */
  async deleteRegistrationMediaObjects(registration: {
    id: number;
    edited_file_url?: string | null;
    review_video_url?: string | null;
  }) {
    const urls = [registration.edited_file_url, registration.review_video_url].filter(
      (url): url is string => Boolean(url),
    );
    let deleted = 0;
    for (const url of urls) {
      try {
        if (await this.objectStorage.deleteManagedObject(url)) {
          deleted += 1;
        }
      } catch (error) {
        this.logger.warn(
          `删除报名 ${registration.id} 素材对象失败：${url}（${error instanceof Error ? error.message : error}）`,
        );
      }
    }
    return deleted;
  }

  async getMedia(
    registrationId: number,
    user: { id: number; role: UserRole },
  ) {
    return this.mediaState(await this.findAccessible(registrationId, user));
  }

  async mediaState(registration: RoadshowRegistration) {
    const [audioAccess, reviewVideoAccess, videoUploadEnabled] = await Promise.all([
      registration.audio_enabled
        ? this.objectStorage.createReadAccess(registration.edited_file_url)
        : Promise.resolve({ url: null, availability: 'unmanaged' as const }),
      registration.review_video_enabled
        ? this.objectStorage.createReadAccess(registration.review_video_url)
        : Promise.resolve({ url: null, availability: 'unmanaged' as const }),
      this.objectStorage.isEnabled(),
    ]);
    return {
      registration_id: registration.id,
      video_upload_enabled: videoUploadEnabled,
      audio: {
        uploaded: !!registration.edited_file_url,
        enabled: !!registration.audio_enabled,
        status: roadshowMediaStatus(registration.audio_enabled, !!registration.edited_file_url),
        url: registration.edited_file_url || null,
        access_url: audioAccess.url,
        availability: registration.edited_file_url && registration.audio_enabled
          ? audioAccess.availability
          : null,
        max_size: AUDIO_MAX_BYTES,
      },
      review_video: {
        uploaded: !!registration.review_video_url,
        enabled: !!registration.review_video_enabled,
        status: roadshowMediaStatus(registration.review_video_enabled, !!registration.review_video_url),
        url: registration.review_video_url || null,
        access_url: reviewVideoAccess.url,
        availability: registration.review_video_url && registration.review_video_enabled
          ? reviewVideoAccess.availability
          : null,
        max_size: VIDEO_MAX_BYTES,
      },
    };
  }

  async signedUrls(registration: RoadshowRegistration, verifyExists = true) {
    if (!verifyExists) {
      const [audioAccessUrl, reviewVideoAccessUrl] = await Promise.all([
        this.objectStorage.createSignedReadUrlUnchecked(registration.edited_file_url),
        this.objectStorage.createSignedReadUrlUnchecked(registration.review_video_url),
      ]);
      return {
        audio_access_url: audioAccessUrl,
        review_video_access_url: reviewVideoAccessUrl,
      };
    }
    const [audioAccess, reviewVideoAccess] = await Promise.all([
      this.objectStorage.createReadAccess(registration.edited_file_url),
      this.objectStorage.createReadAccess(registration.review_video_url),
    ]);
    return {
      audio_access_url: audioAccess.url,
      audio_availability: registration.edited_file_url ? audioAccess.availability : null,
      review_video_access_url: reviewVideoAccess.url,
      review_video_availability: registration.review_video_url ? reviewVideoAccess.availability : null,
    };
  }

  async createAdminDownloadManifest(
    registrationIds: number[],
    mediaTypes: RoadshowMediaType[],
  ): Promise<{
    items: RoadshowMediaDownloadItem[];
    unavailable: RoadshowMediaUnavailableItem[];
  }> {
    const registrations = await this.registrationRepo.find({
      where: { id: In(registrationIds) },
      order: { sort_order: 'ASC', id: 'ASC' },
    });
    const registrationMap = new Map(registrations.map((registration) => [registration.id, registration]));
    const orderedRegistrations = registrationIds
      .map((id) => registrationMap.get(id))
      .filter((registration): registration is RoadshowRegistration => Boolean(registration))
      .sort((a, b) => (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER) || a.id - b.id);
    const result: RoadshowMediaDownloadItem[] = [];
    const unavailable: RoadshowMediaUnavailableItem[] = [];

    // Use unchecked signed URLs to avoid N+1 headObject calls
    for (const registration of orderedRegistrations) {
      for (const mediaType of mediaTypes) {
        const sourceUrl = mediaType === 'audio'
          ? registration.edited_file_url
          : registration.review_video_url;
        if (!sourceUrl) continue;
        const filename = this.adminDownloadFilename(registration, sourceUrl);
        const signedUrl = await this.objectStorage.createSignedReadUrlUnchecked(sourceUrl, filename);
        if (!signedUrl) {
          unavailable.push({
            registration_id: registration.id,
            media_type: mediaType,
            reason: 'unmanaged',
          });
          continue;
        }
        result.push({
          registration_id: registration.id,
          media_type: mediaType,
          group_order: registration.sort_order,
          filename,
          download_url: signedUrl,
        });
      }
    }
    return { items: result, unavailable };
  }

  private async findAccessible(
    id: number,
    user: { id: number; role: UserRole },
    requireWritable = false,
  ) {
    const registration = await this.registrationRepo.findOne({
      where: { id },
      relations: ['session'],
    });
    if (!registration || (user.role !== UserRole.ADMIN && registration.user_id !== user.id)) {
      throw new NotFoundException('报名不存在');
    }
    if (
      requireWritable
      && user.role !== UserRole.ADMIN
      && registration.status === RegistrationStatus.REJECTED
    ) {
      throw new ForbiddenException('已驳回的路演报名不能补充或更换素材');
    }
    return registration;
  }

  private validateFile(type: RoadshowMediaType, dto: CreateRoadshowMediaUploadDto) {
    const isAudio = type === 'audio';
    const maxBytes = isAudio ? AUDIO_MAX_BYTES : VIDEO_MAX_BYTES;
    const extensions = isAudio ? AUDIO_EXTENSIONS : VIDEO_EXTENSIONS;
    const expectedMimePrefix = isAudio ? 'audio/' : 'video/';
    if (dto.file_size > maxBytes) {
      throw new BadRequestException(isAudio ? '音频不能超过 30MB' : '审核视频不能超过 1GB');
    }
    if (!extensions.has(extname(dto.file_name).toLowerCase())) {
      throw new BadRequestException(isAudio
        ? '音频仅支持 mp3、m4a、wav、flac、aac、ogg'
        : '视频仅支持 mp4、mov、m4v、webm');
    }
    if (!dto.content_type.toLowerCase().startsWith(expectedMimePrefix)) {
      throw new BadRequestException(isAudio ? '音频 MIME 类型无效' : '视频 MIME 类型无效');
    }
    return { maxBytes };
  }

  private adminDownloadFilename(registration: RoadshowRegistration, sourceUrl: string) {
    const cleanUrl = sourceUrl.split(/[?#]/, 1)[0];
    const extension = extname(cleanUrl).toLowerCase();
    const safeExtension = /^\.[a-z0-9]{1,8}$/.test(extension) ? extension : '';
    const safePart = (value: string, fallback: string) =>
      value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || fallback;
    return [
      registration.sort_order ?? '未排序',
      registration.id,
      safePart(registration.song_name, '未知歌曲'),
      safePart(registration.group_name, '未知组合'),
    ].join('_') + safeExtension;
  }
}
