import { IsString, MinLength, MaxLength, IsOptional, Matches } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: '用户名只能包含字母、数字和下划线' })
  username: string;

  @IsString()
  @MinLength(6)
  @MaxLength(64)
  password: string;

  @IsOptional() @IsString() @MaxLength(64) nickname?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsString() @MaxLength(128) email?: string;
}

export class LoginDto {
  @IsString() username: string;
  @IsString() password: string;
}

export class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(64) nickname?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsString() @MaxLength(128) email?: string;
  @IsOptional() @IsString() @MinLength(6) password?: string;
}
