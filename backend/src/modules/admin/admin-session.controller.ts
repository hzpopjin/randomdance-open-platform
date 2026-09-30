import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards, HttpException, HttpStatus, ConflictException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Session } from '../sessions/entities/session.entity';
import { RoadshowRegistration } from '../roadshow/entities/roadshow-registration.entity';
import { Submission } from '../submissions/entities/submission.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { isOrganizer, isSuperAdmin, assertSessionOwned, ScopeUser } from '../../common/utils/organizer-scope';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN, UserRole.ORGANIZER)
@Controller('admin/sessions')
export class AdminSessionController {
  constructor(
    @InjectRepository(Session) private sessionRepo: Repository<Session>,
    @InjectRepository(RoadshowRegistration) private registrationRepo: Repository<RoadshowRegistration>,
    @InjectRepository(Submission) private submissionRepo: Repository<Submission>,
  ) {}

  @Get()
  async findAll(@Query() query: PaginationDto, @CurrentUser() user: ScopeUser) {
    const { page = 1, page_size = 10 } = query;
    const organizerScoped = isOrganizer(user);
    const whereClause = organizerScoped ? 'WHERE s.organizer_id = ?' : '';
    const params = organizerScoped
      ? [user.id, page_size, (page - 1) * page_size]
      : [page_size, (page - 1) * page_size];
    const rows = await this.sessionRepo.query(
      `SELECT s.*, o.organizer_name,
        (SELECT COUNT(*) FROM submissions WHERE session_id = s.id) as submission_count,
        (SELECT COUNT(*) FROM roadshow_registrations WHERE session_id = s.id) as registration_count
      FROM sessions s
      LEFT JOIN users o ON o.id = s.organizer_id
      ${whereClause}
      ORDER BY s.event_date DESC LIMIT ? OFFSET ?`,
      params,
    );
    const total = organizerScoped
      ? await this.sessionRepo.count({ where: { organizer_id: user.id } })
      : await this.sessionRepo.count();
    return { list: rows, total, page, page_size };
  }

  @Post()
  create(@Body() body: Partial<Session>, @CurrentUser() user: ScopeUser) {
    // 杜绝 mass-assignment：主键与审计列不得由请求体决定（save() 会以 body.id 作为主键走 UPDATE 分支）。
    delete body.id;
    delete body.created_at;
    delete body.updated_at;
    // 取消态只能经受归属校验的 cancel / restore 专用端点变更。
    delete body.is_cancelled;
    delete body.cancelled_at;
    const session = this.sessionRepo.create(body);
    // organizer_id 由服务端决定：主办方强制自身，超管可显式指定，缺省为自身（系统主办方）。
    session.organizer_id = isSuperAdmin(user) ? (body.organizer_id ?? user.id) : user.id;
    this.assertRoadshowSelectionConfig(session);
    return this.sessionRepo.save(session);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: Partial<Session>, @CurrentUser() user: ScopeUser) {
    const session = await this.sessionRepo.findOne({ where: { id: +id } });
    if (!session) throw new HttpException('场次不存在', HttpStatus.NOT_FOUND);
    assertSessionOwned(session, user);
    // 主办方不得通过 body 改归属；超管可重新指派 organizer_id。
    if (isOrganizer(user)) delete body.organizer_id;
    // 杜绝 mass-assignment：主键与审计列不得由请求体决定（否则 save() 会以 body.id 改写他方场次）。
    delete body.id;
    delete body.created_at;
    delete body.updated_at;
    // 取消态只能经受归属校验的 cancel / restore 专用端点变更。
    delete body.is_cancelled;
    delete body.cancelled_at;
    Object.assign(session, body);
    this.assertRoadshowSelectionConfig(session);
    return this.sessionRepo.save(session);
  }

  @Put(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: ScopeUser) { return this.setCancellation(id, true, user); }

  @Put(':id/restore')
  restore(@Param('id') id: string, @CurrentUser() user: ScopeUser) { return this.setCancellation(id, false, user); }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: ScopeUser) {
    const sessionId = Number(id);
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new HttpException('场次不存在', HttpStatus.NOT_FOUND);
    assertSessionOwned(session, user);
    const [regCount, subCount] = await Promise.all([
      this.registrationRepo.count({ where: { session_id: sessionId } }),
      this.submissionRepo.count({ where: { session_id: sessionId } }),
    ]);
    if (regCount > 0 || subCount > 0) {
      throw new ConflictException(`该场次已有 ${regCount} 条路演报名和 ${subCount} 条歌单投稿，无法删除`);
    }
    try { await this.sessionRepo.delete(sessionId); }
    catch (error) { if (error instanceof QueryFailedError) throw new ConflictException('该场次已产生关联数据，无法删除'); throw error; }
    return { id: session.id, name: session.name };
  }

  private async setCancellation(id: string, isCancelled: boolean, user: ScopeUser) {
    const session = await this.sessionRepo.findOne({ where: { id: +id } });
    if (!session) throw new HttpException('场次不存在', HttpStatus.NOT_FOUND);
    assertSessionOwned(session, user);
    session.is_cancelled = isCancelled;
    session.cancelled_at = isCancelled ? new Date() : null;
    return this.sessionRepo.save(session);
  }

  private assertRoadshowSelectionConfig(session: Session) {
    const slotMinutes = Number(session.roadshow_slot_minutes);
    const halftimeDelayMinutes = Number(session.roadshow_halftime_delay_minutes);
    if (!Number.isInteger(slotMinutes) || slotMinutes < 1 || slotMinutes > 60) {
      throw new HttpException('每组路演时长必须是 1 至 60 分钟的整数', HttpStatus.BAD_REQUEST);
    }
    if (!Number.isInteger(halftimeDelayMinutes) || halftimeDelayMinutes < 0 || halftimeDelayMinutes > 360) {
      throw new HttpException('中场延后时间必须是 0 至 360 分钟的整数', HttpStatus.BAD_REQUEST);
    }
    if (!session.roadshow_selection_enabled) return;
    if (!session.roadshow_selection_open_at) {
      throw new HttpException('启用路演选位时必须设置开放时间', HttpStatus.BAD_REQUEST);
    }
    const openAt = new Date(session.roadshow_selection_open_at).getTime();
    const eventAt = new Date(session.event_date).getTime();
    if (!Number.isFinite(openAt)) {
      throw new HttpException('选位开放时间无效', HttpStatus.BAD_REQUEST);
    }
    if (Number.isFinite(eventAt) && openAt >= eventAt) {
      throw new HttpException('选位开放时间必须早于活动开始时间', HttpStatus.BAD_REQUEST);
    }
  }
}
