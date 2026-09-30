import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const KEY_CONTEXT = 'chaojifather:object-storage-config:v1';

@Injectable()
export class ObjectStorageConfigCryptoService {
  private readonly key: Buffer;

  constructor(configService: ConfigService) {
    const masterSecret =
      configService.get<string>('OBJECT_STORAGE_CONFIG_ENCRYPTION_KEY')?.trim() ||
      configService.get<string>('JWT_SECRET')?.trim() ||
      '';
    if (!masterSecret) {
      throw new Error(
        '缺少 OBJECT_STORAGE_CONFIG_ENCRYPTION_KEY 或 JWT_SECRET，无法安全保存对象存储 Secret Access Key',
      );
    }
    this.key = scryptSync(masterSecret, KEY_CONTEXT, 32);
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [VERSION, iv, tag, ciphertext]
      .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
      .join(':');
  }

  decrypt(payload: string): string {
    const [version, ivValue, tagValue, ciphertextValue] = payload.split(':');
    if (version !== VERSION || !ivValue || !tagValue || !ciphertextValue) {
      throw new Error('对象存储 Secret Access Key 密文格式无效');
    }
    try {
      const decipher = createDecipheriv(
        ALGORITHM,
        this.key,
        Buffer.from(ivValue, 'base64url'),
      );
      decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertextValue, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new Error(
        '对象存储 Secret Access Key 解密失败，请检查加密密钥是否发生变化',
      );
    }
  }
}
