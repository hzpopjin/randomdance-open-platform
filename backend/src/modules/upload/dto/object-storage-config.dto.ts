import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateObjectStorageConfigDto {
  @IsBoolean()
  enabled: boolean;

  @IsString()
  @MaxLength(128)
  accessKeyId: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  accessKeySecret?: string;

  @IsString()
  @Matches(/^[a-z]{2,8}-[a-z0-9-]{2,50}$/, {
    message: 'Region 格式不正确，例如 cn-beijing',
  })
  @MaxLength(64)
  region: string;

  @IsString()
  @Matches(/^(?:https?:\/\/)?[A-Za-z0-9.-]+(?::\d+)?$/, {
    message: 'Endpoint 应为 TOS 访问域名，例如 tos-cn-beijing.volces.com',
  })
  @MaxLength(255)
  endpoint: string;

  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$|^$/, {
    message: 'Bucket 名称只能包含小写字母、数字和中划线，长度为 3～63 个字符',
  })
  @MaxLength(63)
  bucket: string;

  @IsOptional()
  @IsString()
  @IsUrl({ require_protocol: true }, { message: '访问域名必须是完整的 HTTP(S) URL' })
  @MaxLength(512)
  publicBaseUrl?: string;

  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9/_-]*$|^$/, {
    message: '对象前缀只能包含字母、数字、斜杠、中划线和下划线',
  })
  @MaxLength(255)
  keyPrefix: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  roadshowMediaNameTemplate?: string;
}
