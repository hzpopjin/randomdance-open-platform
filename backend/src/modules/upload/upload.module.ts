import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminObjectStorageController } from './admin-object-storage.controller';
import { ObjectStorageConfig } from './entities/object-storage-config.entity';
import { ObjectStorageConfigCryptoService } from './object-storage-config-crypto.service';
import { ObjectStorageConfigService } from './object-storage-config.service';
import { ObjectStorageService } from './object-storage.service';
import { UploadController } from './upload.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ObjectStorageConfig])],
  controllers: [UploadController, AdminObjectStorageController],
  providers: [
    ObjectStorageConfigCryptoService,
    ObjectStorageConfigService,
    ObjectStorageService,
  ],
  exports: [ObjectStorageConfigService, ObjectStorageService],
})
export class UploadModule {}
