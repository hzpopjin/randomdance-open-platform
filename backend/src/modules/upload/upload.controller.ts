import { Controller, Post, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { AUDIO_MAX_BYTES } from '../../common/constants/upload';
import { ObjectStorageService } from './object-storage.service';
import { RoadshowUploadContextDto } from './dto/upload-context.dto';
import { Body } from '@nestjs/common';

@UseGuards(AuthGuard('jwt'))
@Controller('upload')
export class UploadController {
  constructor(private readonly objectStorageService: ObjectStorageService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: AUDIO_MAX_BYTES },
      fileFilter: (_req, file, cb) => {
        const allowed = ['.mp3', '.m4a', '.wav', '.flac', '.aac', '.ogg'];
        const ext = extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('仅支持 mp3, m4a, wav, flac, aac, ogg 格式'), false);
        }
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() context: RoadshowUploadContextDto,
  ) {
    if (!file) throw new BadRequestException('文件上传失败');
    const url = await this.objectStorageService.upload(file, 'roadshow-audio', {
      sessionId: context.sessionId,
    });
    const filename = url.split('/').pop() || file.originalname;
    return { url, filename, originalname: file.originalname };
  }
}
