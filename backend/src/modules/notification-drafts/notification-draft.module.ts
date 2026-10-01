import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationDraft } from './notification-draft.entity';
import { NotificationDraftController } from './notification-draft.controller';
import { NotificationDraftService } from './notification-draft.service';
@Module({ imports: [TypeOrmModule.forFeature([NotificationDraft])], controllers: [NotificationDraftController], providers: [NotificationDraftService] })
export class NotificationDraftModule {}
