import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoadshowRegistration } from './entities/roadshow-registration.entity';
import { RegistrationMember } from './entities/registration-member.entity';
import { Session } from '../sessions/entities/session.entity';
import { RoadshowService } from './roadshow.service';
import { RoadshowController } from './roadshow.controller';
import { RoadshowPosition } from './entities/roadshow-position.entity';
import { RoadshowPositionEvent } from './entities/roadshow-position-event.entity';
import { RoadshowPositionService } from './roadshow-position.service';
import { UploadModule } from '../upload/upload.module';
import { RoadshowMediaService } from './roadshow-media.service';

@Module({
  imports: [UploadModule, TypeOrmModule.forFeature([
    RoadshowRegistration,
    RegistrationMember,
    RoadshowPosition,
    RoadshowPositionEvent,
    Session,
  ])],
  controllers: [RoadshowController],
  providers: [RoadshowService, RoadshowPositionService, RoadshowMediaService],
  exports: [RoadshowService, RoadshowMediaService],
})
export class RoadshowModule {}
