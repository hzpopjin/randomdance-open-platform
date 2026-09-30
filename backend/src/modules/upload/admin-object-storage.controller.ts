import { Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { UpdateObjectStorageConfigDto } from './dto/object-storage-config.dto';
import { ObjectStorageConfigService } from './object-storage-config.service';
import { ObjectStorageService } from './object-storage.service';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/object-storage')
export class AdminObjectStorageController {
  constructor(
    private readonly configService: ObjectStorageConfigService,
    private readonly objectStorageService: ObjectStorageService,
  ) {}

  @Get()
  getConfig() {
    return this.configService.getAdminConfig();
  }

  @Put()
  updateConfig(@Body() dto: UpdateObjectStorageConfigDto) {
    return this.configService.updateConfig(dto);
  }

  @Post('test')
  testConnection() {
    return this.configService.testConnection();
  }

  @Get('access')
  async getReadAccess(@Query('url') url: string) {
    const access = await this.objectStorageService.createReadAccess(url);
    return {
      accessUrl: access.availability === 'unmanaged' && /^https?:\/\//i.test(url || '')
        ? url
        : access.url,
      availability: access.availability,
    };
  }
}
