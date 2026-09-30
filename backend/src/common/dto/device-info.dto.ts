import { IsOptional, IsString } from 'class-validator';

export class DeviceInfoDto {
  @IsOptional() @IsString() platform?: string;
  @IsOptional() @IsString() device_id?: string;
  @IsOptional() @IsString() device_model?: string;
  @IsOptional() @IsString() os_version?: string;
  @IsOptional() @IsString() app_version?: string;
  @IsOptional() @IsString() client_ip?: string;
  @IsOptional() @IsString() user_agent?: string;
  @IsOptional() @IsString() request_id?: string;
  @IsOptional() @IsString() timestamp?: string;
}
