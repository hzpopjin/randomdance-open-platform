import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * 管理端编辑路演报名的显式白名单 DTO。
 * 仅声明允许编辑的字段，配合全局 ValidationPipe(whitelist) 杜绝 Object.assign(body:any) 越权写入
 * （如 user_id/session_id/form_fingerprint/device_info 等敏感列）。
 */
export class UpdateRoadshowRegistrationDto {
  @IsOptional()
  @IsString()
  @MaxLength(256)
  song_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  artist_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  group_name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  song_format?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  contact_phone?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  has_other_performance?: number;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  other_performance_detail?: string;

  @IsOptional()
  @IsString()
  additional_requirements?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  review_comment?: string;

  // status 允许字符串（pending/approved/rejected）或数字（0/1/2），由控制器 toStatusValue 统一校验。
  @IsOptional()
  status?: string | number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort_order?: number;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  edited_file_url?: string;
}
