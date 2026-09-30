import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TosClient, TosServerError } from '@volcengine/tos-sdk';
import { Repository } from 'typeorm';
import { UpdateObjectStorageConfigDto } from './dto/object-storage-config.dto';
import { ObjectStorageConfig } from './entities/object-storage-config.entity';
import { ObjectStorageConfigCryptoService } from './object-storage-config-crypto.service';

const DEFAULT_REGION = 'cn-beijing';
const DEFAULT_ENDPOINT = 'tos-cn-beijing.volces.com';
const DEFAULT_KEY_PREFIX = 'chaojifather';
export const DEFAULT_ROADSHOW_MEDIA_NAME_TEMPLATE = '{registrationNumber}_{songName}_{groupName}';
const ROADSHOW_MEDIA_NAME_VARIABLES = new Set([
  'registrationNumber',
  'registrationId',
  'songName',
  'groupName',
  'artistName',
  'sessionId',
  'sessionName',
  'mediaType',
  'mediaTypeName',
  'timestamp',
  'random',
  '报名序号',
  '报名ID',
  '歌曲名',
  '组名',
  '歌手名',
  '场次ID',
  '场次名',
  '素材类型',
  '素材类型名',
  '上传时间',
  '随机编号',
]);

export interface AdminObjectStorageConfig {
  enabled: boolean;
  provider: 'volcengine_tos';
  accessKeyId: string;
  hasAccessKeySecret: boolean;
  /** 密文存在但解密失败（加密密钥已变更），供前端告警 */
  secretUnreadable: boolean;
  accessKeySecretMasked: string;
  region: string;
  endpoint: string;
  bucket: string;
  publicBaseUrl: string;
  keyPrefix: string;
  roadshowMediaNameTemplate: string;
  updatedAt: Date | null;
}

export interface RuntimeObjectStorageConfig {
  accessKeyId: string;
  accessKeySecret: string;
  region: string;
  endpoint: string;
  bucket: string;
  publicBaseUrl: string;
  keyPrefix: string;
  roadshowMediaNameTemplate: string;
}

@Injectable()
export class ObjectStorageConfigService {
  constructor(
    @InjectRepository(ObjectStorageConfig)
    private readonly configRepo: Repository<ObjectStorageConfig>,
    private readonly cryptoService: ObjectStorageConfigCryptoService,
  ) {}

  async getAdminConfig(): Promise<AdminObjectStorageConfig> {
    const config = await this.getEntity();
    const ciphertext = config?.access_key_secret_ciphertext || '';
    // 试解密一次：密文存在但加密密钥已变更时解密会抛错，
    // 此时返回 hasAccessKeySecret:false + secretUnreadable:true 供前端告警。
    let secretReadable = false;
    if (ciphertext) {
      try {
        this.cryptoService.decrypt(ciphertext);
        secretReadable = true;
      } catch {
        secretReadable = false;
      }
    }
    return {
      enabled: config?.enabled ?? false,
      provider: 'volcengine_tos',
      accessKeyId: config?.access_key_id || '',
      hasAccessKeySecret: secretReadable,
      secretUnreadable: Boolean(ciphertext) && !secretReadable,
      accessKeySecretMasked: ciphertext ? '••••••••••••••••' : '',
      region: config?.region || DEFAULT_REGION,
      endpoint: config?.endpoint || DEFAULT_ENDPOINT,
      bucket: config?.bucket || '',
      publicBaseUrl: config?.public_base_url || '',
      keyPrefix: config ? config.key_prefix : DEFAULT_KEY_PREFIX,
      roadshowMediaNameTemplate: config?.roadshow_media_name_template || DEFAULT_ROADSHOW_MEDIA_NAME_TEMPLATE,
      updatedAt: config?.updated_at || null,
    };
  }

  async updateConfig(input: UpdateObjectStorageConfigDto) {
    let config = await this.getEntity();
    if (!config) {
      config = this.configRepo.create({
        enabled: false,
        provider: 'volcengine_tos',
        access_key_id: '',
        access_key_secret_ciphertext: null,
        region: DEFAULT_REGION,
        endpoint: DEFAULT_ENDPOINT,
        bucket: '',
        public_base_url: '',
        key_prefix: DEFAULT_KEY_PREFIX,
        roadshow_media_name_template: DEFAULT_ROADSHOW_MEDIA_NAME_TEMPLATE,
      });
    }

    const newSecret = input.accessKeySecret?.trim();
    if (newSecret) {
      config.access_key_secret_ciphertext = this.cryptoService.encrypt(newSecret);
    }

    const accessKeyId = input.accessKeyId.trim();
    const endpoint = this.normalizeEndpoint(input.endpoint);
    const bucket = input.bucket.trim();
    if (input.enabled && (!accessKeyId || !config.access_key_secret_ciphertext || !bucket)) {
      throw new BadRequestException(
        '启用对象存储前必须填写 AccessKey ID、Secret Access Key 和 Bucket',
      );
    }

    config.enabled = input.enabled;
    config.provider = 'volcengine_tos';
    // 关闭对象存储时不要清空凭证：仅当输入非空才覆盖 access_key_id/bucket，
    // 避免前端只切换 enabled 标记时意外抹掉已保存的 AccessKey ID 与 Bucket。
    if (input.enabled || accessKeyId) {
      config.access_key_id = accessKeyId;
    }
    if (input.enabled || bucket) {
      config.bucket = bucket;
    }
    config.region = input.region.trim() || DEFAULT_REGION;
    config.endpoint = endpoint || DEFAULT_ENDPOINT;
    config.public_base_url = (input.publicBaseUrl || '').trim().replace(/\/+$/, '');
    config.key_prefix = input.keyPrefix.trim().replace(/^\/+|\/+$/g, '');
    const nameTemplate = input.roadshowMediaNameTemplate?.trim() || DEFAULT_ROADSHOW_MEDIA_NAME_TEMPLATE;
    this.validateRoadshowMediaNameTemplate(nameTemplate);
    config.roadshow_media_name_template = nameTemplate;
    await this.configRepo.save(config);
    return this.getAdminConfig();
  }

  async isEnabled(): Promise<boolean> {
    return Boolean((await this.getEntity())?.enabled);
  }

  async getRuntimeConfig(requireEnabled = true): Promise<RuntimeObjectStorageConfig> {
    const config = await this.getEntity();
    if (!config) throw new BadRequestException('尚未在管理后台保存对象存储配置');
    if (requireEnabled && !config.enabled) {
      throw new BadRequestException('对象存储当前未启用');
    }
    if (!config.access_key_id || !config.access_key_secret_ciphertext || !config.bucket) {
      throw new BadRequestException('对象存储配置不完整');
    }
    return {
      accessKeyId: config.access_key_id,
      accessKeySecret: this.cryptoService.decrypt(config.access_key_secret_ciphertext),
      region: config.region || DEFAULT_REGION,
      endpoint: config.endpoint || DEFAULT_ENDPOINT,
      bucket: config.bucket,
      publicBaseUrl: config.public_base_url || '',
      keyPrefix: config.key_prefix,
      roadshowMediaNameTemplate: config.roadshow_media_name_template || DEFAULT_ROADSHOW_MEDIA_NAME_TEMPLATE,
    };
  }

  createClient(config: RuntimeObjectStorageConfig): TosClient {
    const client = new TosClient({
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      region: config.region,
      endpoint: config.endpoint,
      connectionTimeout: 5_000,
      requestTimeout: 15_000,
      maxRetryCount: 2,
      userAgentProductName: 'chaojifather-api',
    });
    // The host process may use a local HTTP proxy for package downloads. Axios 0.x
    // auto-detects those variables and combines the HTTP proxy with TOS's HTTPS
    // agent incorrectly, so storage traffic must bypass ambient process proxies.
    client.axiosInst.defaults.proxy = false;
    return client;
  }

  async testConnection() {
    const config = await this.getRuntimeConfig(false);
    try {
      const response = await this.createClient(config).headBucket(config.bucket);
      return {
        ok: true as const,
        bucket: config.bucket,
        region: config.region,
        requestId: response.requestId,
      };
    } catch (error) {
      if (error instanceof TosServerError) {
        throw new BadRequestException(
          `TOS 连接失败：${error.code || error.message}${error.requestId ? `（RequestId: ${error.requestId}）` : ''}`,
        );
      }
      throw new BadRequestException(
        `TOS 连接失败：${error instanceof Error ? error.message : '未知错误'}`,
      );
    }
  }

  buildPublicUrl(config: RuntimeObjectStorageConfig, key: string): string {
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');
    const baseUrl = config.publicBaseUrl || `https://${config.bucket}.${config.endpoint}`;
    return `${baseUrl.replace(/\/+$/, '')}/${encodedKey}`;
  }

  private validateRoadshowMediaNameTemplate(template: string): void {
    const placeholders = template.match(/\{([^{}]+)\}/g) || [];
    for (const placeholder of placeholders) {
      const name = placeholder.slice(1, -1);
      if (!ROADSHOW_MEDIA_NAME_VARIABLES.has(name)) {
        throw new BadRequestException(`路演音视频命名变量不支持：{${name}}`);
      }
    }
  }

  private normalizeEndpoint(endpoint: string): string {
    return endpoint.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  }

  private async getEntity(): Promise<ObjectStorageConfig | null> {
    const [config] = await this.configRepo.find({ order: { id: 'ASC' }, take: 1 });
    return config || null;
  }
}
