import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards, HttpException, HttpStatus, StreamableFile, Logger, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, In } from 'typeorm';
import { RegistrationStatus, RoadshowRegistration } from '../roadshow/entities/roadshow-registration.entity';
import { RegistrationMember } from '../roadshow/entities/registration-member.entity';
import { RoadshowPosition } from '../roadshow/entities/roadshow-position.entity';
import { RoadshowPositionEvent, RoadshowPositionEventAction } from '../roadshow/entities/roadshow-position-event.entity';
import { Session } from '../sessions/entities/session.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { RoadshowExportService } from './roadshow-export.service';
import { AdminRoadshowArrangementService } from './admin-roadshow-arrangement.service';
import { RoadshowMediaService, RoadshowMediaType } from '../roadshow/roadshow-media.service';
import { SkipResponseWrap } from '../../common/decorators/skip-response-wrap.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateRoadshowRegistrationDto } from './dto/update-roadshow-registration.dto';
import { isOrganizer, applySessionScope, assertSessionOwned, assertRegistrationsOwned, ScopeUser } from '../../common/utils/organizer-scope';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN, UserRole.ORGANIZER)
@Controller('admin/roadshow/registrations')
export class AdminRoadshowController {
  private readonly logger = new Logger(AdminRoadshowController.name);

  constructor(
    @InjectRepository(RoadshowRegistration) private regRepo: Repository<RoadshowRegistration>,
    @InjectRepository(RegistrationMember) private memberRepo: Repository<RegistrationMember>,
    @InjectRepository(Session) private sessionRepo: Repository<Session>,
    private readonly exportService: RoadshowExportService,
    private readonly arrangementService: AdminRoadshowArrangementService,
    private readonly mediaService: RoadshowMediaService,
  ) {}

  private toStatusValue(status?: string | number) {
    if (status === undefined || status === null || status === '') return undefined;
    const statusMap: Record<string, number> = { pending: 0, approved: 1, rejected: 2 };
    const normalized = String(status);
    return statusMap[normalized] !== undefined ? statusMap[normalized] : Number(normalized);
  }

  /** 校验状态值必须为 0..2 的整数，否则 400（复用 toStatusValue，杜绝 NaN）。 */
  private requireStatusValue(status?: string | number): number {
    const value = this.toStatusValue(status);
    if (value === undefined || !Number.isInteger(value) || value < 0 || value > 2) {
      throw new HttpException('状态值无效，仅支持 pending/approved/rejected 或 0/1/2', HttpStatus.BAD_REQUEST);
    }
    return value;
  }

  private assertRegistrationId(id: number) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new HttpException('报名 ID 无效', HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * 释放报名占用的位次（registration_id/selected_by_user_id/selected_at 置空、admin_locked=false），
   * 并写入 ADMIN_CANCEL 事件记录被清除的 admin_locked 原值。
   */
  private async releasePosition(manager: EntityManager, reg: RoadshowRegistration, adminUserId: number) {
    const posRepo = manager.getRepository(RoadshowPosition);
    const position = await posRepo.findOne({ where: { registration_id: reg.id } });
    if (!position) return;
    const clearedAdminLocked = position.admin_locked;
    await posRepo.update(position.id, {
      registration_id: null,
      selected_by_user_id: null,
      selected_at: null,
      admin_locked: false,
    });
    await manager.getRepository(RoadshowPositionEvent).save({
      session_id: reg.session_id,
      registration_id: reg.id,
      position_id: position.id,
      user_id: adminUserId,
      action: RoadshowPositionEventAction.ADMIN_CANCEL,
      device_info: null,
      cleared_admin_locked: clearedAdminLocked,
    });
  }

  /**
   * 状态变更（只写目标列，避免整实体 save 丢失更新）。
   * 当状态从 approved 改走时，在同一事务内释放该报名占用的位次并将 sort_order 置 null，
   * 杜绝「驳回已选位报名后编排页永久 409 死循环」。
   */
  private async changeStatus(
    registrationId: number,
    user: ScopeUser,
    statusValue: number,
    reviewComment: string | null | undefined,
    extraPatch: Partial<RoadshowRegistration> = {},
  ) {
    this.assertRegistrationId(registrationId);
    return this.regRepo.manager.transaction(async (manager) => {
      const regRepo = manager.getRepository(RoadshowRegistration);
      const reg = await regRepo.findOne({ where: { id: registrationId }, relations: ['session'] });
      if (!reg) throw new HttpException('报名不存在', HttpStatus.NOT_FOUND);
      assertSessionOwned(reg.session, user);
      const wasApproved = reg.status === RegistrationStatus.APPROVED;
      const nowApproved = statusValue === RegistrationStatus.APPROVED;

      const patch: Partial<RoadshowRegistration> = { ...extraPatch, status: statusValue };
      if (reviewComment !== undefined) patch.review_comment = reviewComment;
      await regRepo.update(registrationId, patch);

      if (wasApproved && !nowApproved) {
        await this.releasePosition(manager, reg, user.id);
        await regRepo.update(registrationId, { sort_order: null });
      }
      return {
        id: registrationId,
        status: ['pending', 'approved', 'rejected'][statusValue],
        review_comment: reviewComment !== undefined ? reviewComment : reg.review_comment,
      };
    });
  }

  /** 主办方对单个场次的归属校验（不存在或越权 → 404，与「不存在」语义一致）；超管跳过查询。 */
  private async assertSessionAccess(sessionId: number, user: ScopeUser) {
    if (!isOrganizer(user)) return;
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new HttpException('场次不存在', HttpStatus.NOT_FOUND);
    assertSessionOwned(session, user);
  }

  /** 主办方对一批报名的归属校验（fail closed，含任一非自身 → 403）；超管跳过查询。 */
  private async assertRegistrationsAccess(ids: number[], user: ScopeUser) {
    if (!isOrganizer(user)) return;
    const regs = await this.regRepo.find({ where: { id: In(ids) }, relations: ['session'] });
    assertRegistrationsOwned(regs, user);
  }

  @Get('arrangement/:sessionId')
  async getArrangement(@CurrentUser() user: ScopeUser, @Param('sessionId', ParseIntPipe) sessionId: number) {
    await this.assertSessionAccess(sessionId, user);
    return this.arrangementService.getArrangement(sessionId);
  }

  @Put('arrangement/:sessionId')
  async saveArrangement(
    @CurrentUser() user: ScopeUser,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() body: { expected_version?: string; items?: any[] },
  ) {
    await this.assertSessionAccess(sessionId, user);
    return this.arrangementService.saveArrangement(sessionId, user.id, body);
  }

  @Get()
  async findAll(@Query() query: PaginationDto & { status?: string; session_id?: number; keyword?: string; sort_by?: string; sort_order?: string }, @CurrentUser() user: ScopeUser) {
    const page = Number(query.page || 1);
    const pageSize = Number(query.page_size || 10);
    const status = this.toStatusValue(query.status);
    const sessionId = Number(query.session_id);
    const keyword = query.keyword?.trim();

    const sortMap: Record<string, string> = {
      id: 'r.id', created_at: 'r.created_at', updated_at: 'r.updated_at',
      song_name: 'r.song_name', artist_name: 'r.artist_name', group_name: 'r.group_name',
      contact_phone: 'r.contact_phone', session_name: 'session.name', status: 'r.status',
      sort_order: 'r.sort_order',
    };
    const sortColumn = sortMap[query.sort_by || 'created_at'] || 'r.created_at';
    const sortOrder = query.sort_order === 'ASC' || query.sort_order === 'ascend' ? 'ASC' : 'DESC';

    const qb = this.regRepo.createQueryBuilder('r')
      .leftJoinAndSelect('r.session', 'session')
      .leftJoinAndSelect('r.user', 'user')
      .leftJoinAndSelect('r.members', 'members')
      .leftJoinAndSelect('r.position', 'position');

    if (status !== undefined && !Number.isNaN(status)) qb.andWhere('r.status = :status', { status });
    if (sessionId && !Number.isNaN(sessionId)) qb.andWhere('r.session_id = :sessionId', { sessionId });
    if (keyword) {
      qb.andWhere('(r.group_name LIKE :kw OR r.song_name LIKE :kw OR r.artist_name LIKE :kw OR r.contact_phone LIKE :kw OR user.username LIKE :kw OR user.nickname LIKE :kw)', { kw: `%${keyword}%` });
    }

    applySessionScope(qb, user, 'session');

    const [list, total] = await qb.orderBy(sortColumn, sortOrder).addOrderBy('r.id', 'DESC')
      .skip((page - 1) * pageSize).take(pageSize).getManyAndCount();

    // 列表用 unchecked 签名补 access url，避免 N+1 headObject。
    const items = await Promise.all(list.map(async (r) => {
      const signed = await this.mediaService.signedUrls(r, false);
      return {
        id: r.id, user_id: r.user_id, user_nickname: r.user?.nickname || '',
        username: r.user?.username || '', session_id: r.session_id,
        session_name: r.session?.name || '', song_name: r.song_name,
        artist_name: r.artist_name, group_name: r.group_name, song_format: r.song_format,
        edited_file_url: r.edited_file_url,
        audio_access_url: signed.audio_access_url,
        review_video_url: r.review_video_url,
        review_video_access_url: signed.review_video_access_url,
        contact_phone: r.contact_phone,
        member_count: r.members?.length || 0, has_other_performance: r.has_other_performance,
        other_performance_detail: r.other_performance_detail,
        additional_requirements: r.additional_requirements,
        status: ['pending', 'approved', 'rejected'][r.status] || 'pending',
        review_comment: r.review_comment,
        sort_order: r.sort_order,
        position_section: r.position?.section || null,
        position_no: r.position?.position_no || null,
        members: r.members?.map((m) => ({ id: m.id, member_name: m.member_name, position: m.position, sort_order: m.sort_order })) || [],
        created_at: r.created_at, updated_at: r.updated_at,
      };
    }));

    return { list: items, total, page, page_size: pageSize };
  }

  @Get('export')
  @SkipResponseWrap()
  async export(@CurrentUser() user: ScopeUser, @Query() query: { session_id?: number; status?: string }) {
    if (!query.session_id) throw new HttpException('请选择要导出的活动场次', HttpStatus.BAD_REQUEST);
    await this.assertSessionAccess(Number(query.session_id), user);
    const { buffer, filename } = await this.exportService.build(Number(query.session_id), query.status);
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    });
  }

  @Post('batch')
  async batchReview(
    @CurrentUser() user: ScopeUser,
    @Body() body: { ids: number[]; status: string; review_comment?: string },
  ) {
    const ids = Array.isArray(body.ids)
      ? body.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0)
      : [];
    if (ids.length === 0) throw new HttpException('请提供要审核的报名 ID 列表', HttpStatus.BAD_REQUEST);
    const statusValue = this.requireStatusValue(body.status);
    const reviewComment = body.review_comment || null;
    // 主办方批量入口 fail closed：含任一非自身数据 → 403。
    await this.assertRegistrationsAccess(ids, user);
    // 逐个走 changeStatus，确保离开 approved 时释放位次（#2）。
    let affected = 0;
    for (const id of ids) {
      try {
        await this.changeStatus(id, user, statusValue, reviewComment);
        affected += 1;
      } catch (error) {
        if (error instanceof HttpException && error.getStatus() === HttpStatus.NOT_FOUND) continue;
        throw error;
      }
    }
    return { affected };
  }

  @Post('media-download-manifest')
  async mediaDownloadManifest(@CurrentUser() user: ScopeUser, @Body() body: { ids?: number[]; media_types?: RoadshowMediaType[] }) {
    const ids = Array.isArray(body.ids)
      ? body.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0)
      : [];
    if (ids.length === 0) throw new HttpException('请提供要下载的报名 ID 列表', HttpStatus.BAD_REQUEST);
    await this.assertRegistrationsAccess(ids, user);
    const allowed: RoadshowMediaType[] = ['audio', 'review-video'];
    const types = Array.isArray(body.media_types) && body.media_types.length > 0
      ? body.media_types.filter((t) => allowed.includes(t))
      : allowed;
    if (types.length === 0) throw new HttpException('媒体类型无效', HttpStatus.BAD_REQUEST);
    return this.mediaService.createAdminDownloadManifest(ids, types);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: ScopeUser, @Param('id') id: string) {
    const reg = await this.regRepo.findOne({ where: { id: +id }, relations: ['session', 'members', 'user'] });
    if (!reg) throw new HttpException('报名不存在', HttpStatus.NOT_FOUND);
    assertSessionOwned(reg.session, user);
    // 复用 RoadshowMediaService.signedUrls 返回私有读签名 URL（含存在性校验）。
    const signed = await this.mediaService.signedUrls(reg, true);
    return {
      id: reg.id, user_id: reg.user_id, user_nickname: reg.user?.nickname || '',
      username: reg.user?.username || '', session_id: reg.session_id,
      session_name: reg.session?.name || '', song_name: reg.song_name,
      artist_name: reg.artist_name, group_name: reg.group_name, song_format: reg.song_format,
      edited_file_url: reg.edited_file_url,
      audio_access_url: signed.audio_access_url,
      review_video_url: reg.review_video_url,
      review_video_access_url: signed.review_video_access_url,
      contact_phone: reg.contact_phone,
      has_other_performance: reg.has_other_performance,
      other_performance_detail: reg.other_performance_detail,
      additional_requirements: reg.additional_requirements,
      status: ['pending', 'approved', 'rejected'][reg.status] || 'pending',
      review_comment: reg.review_comment,
      sort_order: reg.sort_order,
      members: reg.members?.map((m) => ({ id: m.id, member_name: m.member_name, position: m.position, sort_order: m.sort_order })) || [],
      created_at: reg.created_at, updated_at: reg.updated_at,
    };
  }

  @Put(':id/status')
  async updateStatus(
    @CurrentUser() user: ScopeUser,
    @Param('id') id: string,
    @Body() body: { status: string; review_comment?: string },
  ) {
    const statusValue = this.requireStatusValue(body.status);
    return this.changeStatus(+id, user, statusValue, body.review_comment || null);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: ScopeUser,
    @Param('id') id: string,
    @Body() body: UpdateRoadshowRegistrationDto,
  ) {
    const registrationId = +id;
    this.assertRegistrationId(registrationId);

    // 显式白名单构建 patch，杜绝 Object.assign(body:any) 越权写入（#13）。
    const patch: Partial<RoadshowRegistration> = {};
    if (body.song_name !== undefined) patch.song_name = body.song_name;
    if (body.artist_name !== undefined) patch.artist_name = body.artist_name;
    if (body.group_name !== undefined) patch.group_name = body.group_name;
    if (body.song_format !== undefined) patch.song_format = body.song_format;
    if (body.contact_phone !== undefined) patch.contact_phone = body.contact_phone;
    if (body.has_other_performance !== undefined) patch.has_other_performance = body.has_other_performance;
    if (body.other_performance_detail !== undefined) patch.other_performance_detail = body.other_performance_detail;
    if (body.additional_requirements !== undefined) patch.additional_requirements = body.additional_requirements;
    if (body.edited_file_url !== undefined) patch.edited_file_url = body.edited_file_url;
    if (body.sort_order !== undefined) patch.sort_order = body.sort_order;

    if (body.status !== undefined) {
      const statusValue = this.requireStatusValue(body.status);
      return this.changeStatus(registrationId, user, statusValue, body.review_comment, patch);
    }

    const reg = await this.regRepo.findOne({ where: { id: registrationId }, relations: ['session'] });
    if (!reg) throw new HttpException('报名不存在', HttpStatus.NOT_FOUND);
    assertSessionOwned(reg.session, user);
    if (body.review_comment !== undefined) patch.review_comment = body.review_comment;
    if (Object.keys(patch).length > 0) {
      // 只写目标列，避免整实体 save() 回写陈旧列（#6）。
      await this.regRepo.update(registrationId, patch);
    }
    return { id: registrationId };
  }

  @Delete('batch')
  async batchRemove(@CurrentUser() user: ScopeUser, @Body() body: { ids: number[] }) {
    const ids = Array.isArray(body.ids)
      ? body.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0)
      : [];
    if (ids.length === 0) throw new HttpException('请提供要删除的ID列表', HttpStatus.BAD_REQUEST);
    // 主办方批量入口 fail closed：含任一非自身数据 → 403。
    await this.assertRegistrationsAccess(ids, user);
    // 先捕获素材 URL，删库成功后再异步清理 TOS 对象，保证「记录在 ⇒ 对象在」（#15）。
    const registrations = await this.regRepo.find({ where: { id: In(ids) } });
    await this.memberRepo.delete({ registration_id: In(ids) });
    await this.regRepo.delete({ id: In(ids) });
    const targets = registrations.map((r) => ({
      id: r.id,
      edited_file_url: r.edited_file_url,
      review_video_url: r.review_video_url,
    }));
    setImmediate(() => {
      for (const target of targets) {
        this.mediaService.deleteRegistrationMediaObjects(target).catch((error) =>
          this.logger.warn(`批量删除后清理报名 ${target.id} 素材失败：${error instanceof Error ? error.message : error}`),
        );
      }
    });
    return { affected: registrations.length };
  }

  @Delete(':id')
  async remove(@CurrentUser() user: ScopeUser, @Param('id') id: string) {
    const registrationId = Number(id);
    this.assertRegistrationId(registrationId);
    const reg = await this.regRepo.findOne({ where: { id: registrationId }, relations: ['session'] });
    if (!reg) throw new HttpException('报名不存在', HttpStatus.NOT_FOUND);
    assertSessionOwned(reg.session, user);
    const target = {
      id: reg.id,
      edited_file_url: reg.edited_file_url,
      review_video_url: reg.review_video_url,
    };
    // 先删库（members/registration）成功后再异步清理 TOS 对象（#15）。
    await this.memberRepo.delete({ registration_id: registrationId });
    await this.regRepo.remove(reg);
    setImmediate(() => {
      this.mediaService.deleteRegistrationMediaObjects(target).catch((error) =>
        this.logger.warn(`删除报名 ${target.id} 后清理素材失败：${error instanceof Error ? error.message : error}`),
      );
    });
    return { id: registrationId };
  }
}
