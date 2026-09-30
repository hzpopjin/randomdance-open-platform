import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { RoadshowModule } from '../roadshow/roadshow.module';
import { User } from '../users/entities/user.entity';
import { Session } from '../sessions/entities/session.entity';
import { RoadshowRegistration } from '../roadshow/entities/roadshow-registration.entity';
import { RegistrationMember } from '../roadshow/entities/registration-member.entity';
import { RoadshowPosition } from '../roadshow/entities/roadshow-position.entity';
import { RoadshowPositionEvent } from '../roadshow/entities/roadshow-position-event.entity';
import { Submission } from '../submissions/entities/submission.entity';
import { SubmissionSong } from '../submissions/entities/submission-song.entity';
import { Song } from '../songs/entities/song.entity';
import { SystemLog } from '../system-logs/entities/system-log.entity';
import { ClientEvent } from '../client-events/entities/client-event.entity';
import { AdminAuthController } from './admin-auth.controller';
import { AdminSessionController } from './admin-session.controller';
import { AdminRoadshowController } from './admin-roadshow.controller';
import { AdminSubmissionController } from './admin-submission.controller';
import { AdminSongController } from './admin-song.controller';
import { AdminUserController } from './admin-user.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { RoadshowExportService } from './roadshow-export.service';
import { SubmissionExportService } from './submission-export.service';
import { AdminRoadshowArrangementService } from './admin-roadshow-arrangement.service';
import { SongService } from '../songs/song.service';

@Module({
  imports: [
    AuthModule,
    RoadshowModule,
    TypeOrmModule.forFeature([
      User, Session, RoadshowRegistration, RegistrationMember,
      RoadshowPosition, RoadshowPositionEvent,
      Submission, SubmissionSong, Song, SystemLog, ClientEvent,
    ]),
  ],
  controllers: [
    AdminAuthController, AdminSessionController, AdminRoadshowController,
    AdminSubmissionController, AdminSongController, AdminUserController,
    AdminDashboardController,
  ],
  providers: [RoadshowExportService, SubmissionExportService, AdminRoadshowArrangementService, SongService],
})
export class AdminModule {}
