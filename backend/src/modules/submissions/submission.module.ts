import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Submission } from './entities/submission.entity';
import { SubmissionSong } from './entities/submission-song.entity';
import { Session } from '../sessions/entities/session.entity';
import { SubmissionService } from './submission.service';
import { SubmissionController } from './submission.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Submission, SubmissionSong, Session])],
  providers: [SubmissionService],
  controllers: [SubmissionController],
  exports: [SubmissionService],
})
export class SubmissionModule {}
