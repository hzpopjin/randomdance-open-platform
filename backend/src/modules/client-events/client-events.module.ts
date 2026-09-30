import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientEvent } from './entities/client-event.entity';
import { ClientEventsService } from './client-events.service';
import { ClientEventsController } from './client-events.controller';
import { AdminClientEventsController } from './admin-client-events.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ClientEvent])],
  providers: [ClientEventsService],
  controllers: [ClientEventsController, AdminClientEventsController],
  exports: [ClientEventsService],
})
export class ClientEventsModule {}
