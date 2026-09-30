import { Controller, Post, Get, Param, Query, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { SubmissionService } from './submission.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsString, IsInt, IsArray, IsOptional, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { DeviceInfoDto } from '../../common/dto/device-info.dto';
import { extractDeviceInfo } from '../../common/utils/device-info.util';

class SubmissionSongDto {
  @IsInt() @IsOptional() song_id?: number;
  @IsString() song_name: string;
  @IsString() artist_name: string;
  @IsString() @IsOptional() alt_title?: string;
  @IsString() @IsOptional() full_title?: string;
  @IsString() @IsOptional() file_extension?: string;
  @IsString() @IsOptional() full_file_path?: string;
  @IsString() @IsOptional() chorus_file_path?: string;
  @IsString() @IsOptional() reference_url?: string;
  @IsInt() @Min(0) @Max(2) play_part: number;
  @IsString() @IsOptional() custom_part_desc?: string;
  @IsInt() @IsOptional() sort_order?: number;
}

class CreateSubmissionDto {
  @IsInt() session_id: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => SubmissionSongDto) songs: SubmissionSongDto[];
  @IsOptional() @ValidateNested() @Type(() => DeviceInfoDto) device_info?: DeviceInfoDto;
}

@UseGuards(AuthGuard('jwt'))
@Controller('submissions')
export class SubmissionController {
  constructor(private submissionService: SubmissionService) {}

  @Post()
  create(@CurrentUser('id') userId: number, @Req() req: Request, @Body() dto: CreateSubmissionDto) {
    const deviceInfo = extractDeviceInfo(req, dto.device_info);
    return this.submissionService.create(userId, dto, deviceInfo);
  }

  @Get('mine')
  findMine(@CurrentUser('id') userId: number, @Query() query: PaginationDto) {
    return this.submissionService.findMine(userId, query.page, query.page_size);
  }

  @Get(':id')
  findOne(@CurrentUser('id') userId: number, @Param('id') id: string) {
    return this.submissionService.findById(+id, userId);
  }
}
