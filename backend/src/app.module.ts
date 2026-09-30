import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/users/user.module';
import { SessionModule } from './modules/sessions/session.module';
import { RoadshowModule } from './modules/roadshow/roadshow.module';
import { SubmissionModule } from './modules/submissions/submission.module';
import { SongModule } from './modules/songs/song.module';
import { UploadModule } from './modules/upload/upload.module';
import { AdminModule } from './modules/admin/admin.module';
import { ClientEventsModule } from './modules/client-events/client-events.module';
import { ClientConfigModule } from './modules/client-config/client-config.module';
import { SystemLogsModule } from './modules/system-logs/system-logs.module';
import { User } from './modules/users/entities/user.entity';
import { Session } from './modules/sessions/entities/session.entity';
import { RoadshowRegistration } from './modules/roadshow/entities/roadshow-registration.entity';
import { RegistrationMember } from './modules/roadshow/entities/registration-member.entity';
import { Submission } from './modules/submissions/entities/submission.entity';
import { SubmissionSong } from './modules/submissions/entities/submission-song.entity';
import { Song } from './modules/songs/entities/song.entity';
import { ClientEvent } from './modules/client-events/entities/client-event.entity';
import { ClientConfig } from './modules/client-config/entities/client-config.entity';
import { SystemLog } from './modules/system-logs/entities/system-log.entity';
import { RoadshowPosition } from './modules/roadshow/entities/roadshow-position.entity';
import { RoadshowPositionEvent } from './modules/roadshow/entities/roadshow-position-event.entity';
import { ObjectStorageConfig } from './modules/upload/entities/object-storage-config.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: join(__dirname, '..', '.env') }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: config.get<any>('DB_TYPE', 'mysql'),
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 3306),
        username: config.getOrThrow<string>('DB_USERNAME'),
        password: config.getOrThrow<string>('DB_PASSWORD'),
        database: config.getOrThrow<string>('DB_DATABASE'),
        entities: [
          User, Session, RoadshowRegistration, RegistrationMember,
          Submission, SubmissionSong, Song, ClientEvent, ClientConfig, SystemLog,
          RoadshowPosition, RoadshowPositionEvent, ObjectStorageConfig,
        ],
        synchronize: true,
      }),
    }),
    AuthModule, UserModule, SessionModule, RoadshowModule, SubmissionModule,
    SongModule, UploadModule, AdminModule, ClientEventsModule, ClientConfigModule,
    SystemLogsModule,
  ],
})
export class AppModule {}
