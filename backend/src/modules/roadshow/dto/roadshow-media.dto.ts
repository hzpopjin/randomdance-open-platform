import { Type } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min } from 'class-validator';

export class CreateRoadshowMediaUploadDto {
  @IsString()
  @MaxLength(255)
  file_name: string;

  @IsString()
  @MaxLength(128)
  content_type: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  file_size: number;
}

export class CompleteRoadshowMediaUploadDto {
  @IsString()
  @MaxLength(1024)
  object_key: string;
}
