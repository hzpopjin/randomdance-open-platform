import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { DraftActor, NotificationDraftService } from './notification-draft.service';
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN, UserRole.ORGANIZER)
@Controller('admin/notification-drafts')
export class NotificationDraftController {
  constructor(private readonly service: NotificationDraftService) {}
  @Get() list(@CurrentUser() actor: DraftActor) { return this.service.list(actor); }
  @Get(':id') get(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: DraftActor) { return this.service.get(id, actor); }
  // Keep bodies unknown: strict allow-list validation rejects forged audit/ownership fields
  // rather than letting the global whitelist pipe silently strip them.
  @Post() create(@Body() body: unknown, @CurrentUser() actor: DraftActor) { return this.service.create(body, actor); }
  @Put(':id') update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @CurrentUser() actor: DraftActor) { return this.service.update(id, body, actor); }
  @Post(':id/archive') archive(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @CurrentUser() actor: DraftActor) { return this.service.archive(id, body, actor, 'archived'); }
  @Post(':id/restore') restore(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @CurrentUser() actor: DraftActor) { return this.service.archive(id, body, actor, 'draft'); }
  @Post(':id/preview') preview(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @CurrentUser() actor: DraftActor) { return this.service.preview(id, body, actor); }
}
