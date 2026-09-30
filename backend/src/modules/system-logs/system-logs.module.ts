import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemLog } from './entities/system-log.entity';
import { SystemLogService } from './system-log.service';
import { AdminSystemLogsController } from './admin-system-logs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SystemLog])],
  providers: [SystemLogService],
  controllers: [AdminSystemLogsController],
  exports: [SystemLogService],
})
export class SystemLogsModule {}
