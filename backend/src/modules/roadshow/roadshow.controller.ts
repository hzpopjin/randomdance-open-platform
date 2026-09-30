import { BadRequestException, Controller, Post, Get, Put, Delete, Param, Query, Body, Req, UseGuards, ParseIntPipe, UseInterceptors, UploadedFile } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { VIDEO_MAX_BYTES } from '../../common/constants/upload';
import { RoadshowService } from './roadshow.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsString, IsInt, IsArray, IsOptional, MinLength, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { DeviceInfoDto } from '../../common/dto/device-info.dto';
import { extractDeviceInfo } from '../../common/utils/device-info.util';
import { RoadshowPositionService } from './roadshow-position.service';
import { CancelRoadshowPositionDto, SelectRoadshowPositionDto } from './dto/roadshow-position.dto';
import { CompleteRoadshowMediaUploadDto, CreateRoadshowMediaUploadDto } from './dto/roadshow-media.dto';
import { RoadshowMediaService, RoadshowMediaType } from './roadshow-media.service';
import { UserRole } from '../users/entities/user.entity';

class MemberDto {
  @IsString() member_name: string;
  @IsString() @IsOptional() position: string;
  @IsInt() sort_order: number;
}

class CreateRegistrationDto {
  @IsInt() session_id: number;
  @IsString() @MinLength(1) song_name: string;
  @IsString() @MinLength(1) artist_name: string;
  @IsString() @MinLength(1) group_name: string;
  @IsInt() @Min(0) @Max(1) song_format: number;
  @IsString() @IsOptional() edited_file_url?: string;
  @IsString() @MinLength(1) contact_phone: string;
  @IsInt() @Min(0) @Max(1) has_other_performance: number;
  @IsString() @IsOptional() other_performance_detail?: string;
  @IsString() @IsOptional() additional_requirements?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => MemberDto) members: MemberDto[];
  @IsOptional() @ValidateNested() @Type(() => DeviceInfoDto) device_info?: DeviceInfoDto;
}

@UseGuards(AuthGuard('jwt'))
@Controller('roadshow/registrations')
export class RoadshowController {
  constructor(
    private roadshowService: RoadshowService,
    private roadshowPositionService: RoadshowPositionService,
    private roadshowMediaService: RoadshowMediaService,
  ) {}

  @Post()
  create(@CurrentUser('id') userId: number, @Req() req: Request, @Body() dto: CreateRegistrationDto) {
    const deviceInfo = extractDeviceInfo(req, dto.device_info);
    return this.roadshowService.create(userId, dto, deviceInfo);
  }

  @Get('mine')
  findMine(@CurrentUser('id') userId: number, @Query() query: PaginationDto) {
    return this.roadshowService.findMine(userId, query.page, query.page_size);
  }

  @Post(':id/media/:type/upload-url')
  createMediaUpload(
    @CurrentUser() user: { id: number; role: UserRole },
    @Param('id', ParseIntPipe) id: number,
    @Param('type') type: string,
    @Body() dto: CreateRoadshowMediaUploadDto,
  ) {
    return this.roadshowMediaService.createUpload(id, user, this.mediaType(type), dto);
  }

  @Post(':id/media/:type/complete')
  completeMediaUpload(
    @CurrentUser() user: { id: number; role: UserRole },
    @Param('id', ParseIntPipe) id: number,
    @Param('type') type: string,
    @Body() dto: CompleteRoadshowMediaUploadDto,
  ) {
    return this.roadshowMediaService.completeUpload(id, user, this.mediaType(type), dto.object_key);
  }

  // 本地 multipart 上传回退端点（仅 TOS 未启用时使用，字段名 file）。
  // 上限取 audio/video 较大值 1GB，具体按类型的大小校验在服务层完成。
  @Post(':id/media/:type')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: VIDEO_MAX_BYTES },
    }),
  )
  uploadMediaLocal(
    @CurrentUser() user: { id: number; role: UserRole },
    @Param('id', ParseIntPipe) id: number,
    @Param('type') type: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.roadshowMediaService.uploadLocal(id, user, this.mediaType(type), file);
  }

  @Get(':id/media')
  getMedia(
    @CurrentUser() user: { id: number; role: UserRole },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.roadshowMediaService.getMedia(id, user);
  }

  @Get(':id/positions')
  getPositions(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.roadshowPositionService.getBoard(userId, id);
  }

  @Put(':id/position')
  selectPosition(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Body() dto: SelectRoadshowPositionDto,
  ) {
    const deviceInfo = extractDeviceInfo(req, dto.device_info);
    return this.roadshowPositionService.select(userId, id, dto.position_id, deviceInfo);
  }

  @Delete(':id/position')
  cancelPosition(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Body() dto: CancelRoadshowPositionDto,
  ) {
    const deviceInfo = extractDeviceInfo(req, dto?.device_info);
    return this.roadshowPositionService.cancel(userId, id, deviceInfo);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: { id: number; role: UserRole },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.roadshowService.findById(id, user.id, user.role);
  }

  private mediaType(type: string): RoadshowMediaType {
    if (type !== 'audio' && type !== 'review-video') {
      throw new BadRequestException('媒体类型仅支持 audio 或 review-video');
    }
    return type;
  }
}
