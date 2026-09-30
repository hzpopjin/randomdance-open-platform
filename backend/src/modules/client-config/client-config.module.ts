import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientConfig } from './entities/client-config.entity';
import { ClientConfigService } from './client-config.service';
import { ClientConfigController } from './client-config.controller';
import { AdminClientConfigController } from './admin-client-config.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ClientConfig])],
  providers: [ClientConfigService],
  controllers: [ClientConfigController, AdminClientConfigController],
  exports: [ClientConfigService],
})
export class ClientConfigModule {}
