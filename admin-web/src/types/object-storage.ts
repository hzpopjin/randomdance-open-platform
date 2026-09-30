export interface AdminObjectStorageConfig {
  enabled: boolean;
  provider: 'volcengine_tos';
  accessKeyId: string;
  hasAccessKeySecret: boolean;
  accessKeySecretMasked: string;
  // 后端无法解密已保存的 Secret（如加密密钥轮换）时为 true，需管理员重填。
  secretUnreadable?: boolean;
  region: string;
  endpoint: string;
  bucket: string;
  publicBaseUrl: string;
  keyPrefix: string;
  roadshowMediaNameTemplate: string;
  updatedAt: string | null;
}

export interface UpdateObjectStorageConfigInput {
  enabled: boolean;
  accessKeyId: string;
  accessKeySecret?: string;
  region: string;
  endpoint: string;
  bucket: string;
  publicBaseUrl?: string;
  keyPrefix: string;
  roadshowMediaNameTemplate?: string;
}

export interface ObjectStorageTestResult {
  ok: true;
  bucket: string;
  region: string;
  requestId: string;
}

export type ObjectStorageAvailability = 'available' | 'missing' | 'unmanaged';

export interface ObjectStorageReadAccess {
  accessUrl: string | null;
  availability: ObjectStorageAvailability;
}
