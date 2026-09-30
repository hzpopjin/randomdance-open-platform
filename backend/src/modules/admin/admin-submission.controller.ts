import { Controller, Get, Put, Post, Delete, Param, Query, Body, UseGuards, HttpException, HttpStatus, StreamableFile } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Submission, SubmissionStatus } from '../submissions/entities/submission.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { SubmissionExportService } from './submission-export.service';
import { SkipResponseWrap } from '../../common/decorators/skip-response-wrap.decorator';
import { Session } from '../sessions/entities/session.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { isOrganizer, applySessionScope, assertSessionOwned, assertRegistrationsOwned, ScopeUser } from '../../common/utils/organizer-scope';

/** 合法审核状态白名单（与 SubmissionStatus 枚举、导出 statusMap 一致）。 */
const VALID_SUBMISSION_STATUS = [SubmissionStatus.PENDING, SubmissionStatus.APPROVED, SubmissionStatus.REJECTED] as const;

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN, UserRole.ORGANIZER)
@Controller('admin/submissions')
export class AdminSubmissionController {
  constructor(
    @InjectRepository(Submission) private subRepo: Repository<Submission>,
    @InjectRepository(Session) private sessionRepo: Repository<Session>,
    private readonly exportService: SubmissionExportService,
  ) {}

  /** 主办方对单个场次归属校验（不存在或越权 → 404）；超管跳过查询。 */
  private async assertSessionAccess(sessionId: number, user: ScopeUser) {
    if (!isOrganizer(user)) return;
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new HttpException('场次不存在', HttpStatus.NOT_FOUND);
    assertSessionOwned(session, user);
  }

  /**
   * 批量投稿前置校验：ids 必须全部存在（缺失 → 400「部分投稿不存在」，杜绝静默放行），
   * 再做归属 fail closed 校验（主办方含任一非自身数据 → 403）；超管跳过归属校验。
   */
  private async assertSubmissionsAccess(ids: number[], user: ScopeUser) {
    const uniqueIds = Array.from(new Set(ids));
    const subs = await this.subRepo.find({ where: { id: In(uniqueIds) }, relations: ['session'] });
    if (subs.length !== uniqueIds.length) throw new HttpException('部分投稿不存在', HttpStatus.BAD_REQUEST);
    assertRegistrationsOwned(subs, user);
  }

  /** 批量入口 ids 规范化：非数组 / 非正整数过滤后为空集合 → 400（与 roadshow 侧同构）。 */
  private normalizeIds(raw: unknown): number[] {
    const ids = Array.isArray(raw) ? raw.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
    if (ids.length === 0) throw new HttpException('请提供要操作的投稿 ID 列表', HttpStatus.BAD_REQUEST);
    return ids;
  }

  /** 审核状态白名单校验：非法值（含带空格 / 脏值）→ 400，避免污染 ?status= 过滤与分组统计。 */
  private requireStatus(raw: unknown): SubmissionStatus {
    const value = String(raw ?? '').trim();
    if (!(VALID_SUBMISSION_STATUS as readonly string[]).includes(value)) {
      throw new HttpException('审核状态无效', HttpStatus.BAD_REQUEST);
    }
    return value as SubmissionStatus;
  }

  @Get()
  async findAll(@Query() query: PaginationDto & { status?: string; session_id?: number; keyword?: string }, @CurrentUser() user: ScopeUser) {
    const { page = 1, page_size = 10, status, session_id, keyword } = query;
    const qb = this.subRepo.createQueryBuilder('s')
      .leftJoinAndSelect('s.session', 'session')
      .leftJoinAndSelect('s.user', 'user')
      .leftJoinAndSelect('s.songs', 'songs');
    if (status) qb.andWhere('s.status = :status', { status });
    if (session_id) qb.andWhere('s.session_id = :sessionId', { sessionId: session_id });
    if (keyword) {
      qb.andWhere('(user.username LIKE :kw OR user.nickname LIKE :kw OR user.phone LIKE :kw)', { kw: `%${keyword}%` });
    }
    applySessionScope(qb, user, 'session');
    const [list, total] = await qb.orderBy('s.created_at', 'DESC')
      .skip((page - 1) * page_size).take(page_size).getManyAndCount();

    return {
      list: list.map((s) => ({
        id: s.id, user_id: s.user_id, user_nickname: s.user?.nickname || '',
        username: s.user?.username || '', user_phone: s.user?.phone || '',
        session_id: s.session_id, session_name: s.session?.name || '',
        status: s.status, review_comment: s.review_comment,
        song_count: s.songs?.length || 0,
        custom_song_count: s.songs?.filter((song) => !song.song_id).length || 0,
        created_at: s.created_at, updated_at: s.updated_at,
      })), total, page, page_size,
    };
  }

  @Get('export')
  @SkipResponseWrap()
  async export(@CurrentUser() user: ScopeUser, @Query() query: { session_id?: number }) {
    if (!query.session_id) throw new HttpException('请选择要导出的活动场次', HttpStatus.BAD_REQUEST);
    await this.assertSessionAccess(Number(query.session_id), user);
    const { buffer, filename } = await this.exportService.build(Number(query.session_id));
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    });
  }

  @Get('statistics')
  async statistics(@CurrentUser() user: ScopeUser, @Query() query: { session_id?: number }) {
    const qb = this.subRepo.createQueryBuilder('s')
      .leftJoinAndSelect('s.songs', 'songs')
      .leftJoin('s.session', 'session');
    if (query.session_id) qb.andWhere('s.session_id = :sessionId', { sessionId: query.session_id });
    applySessionScope(qb, user, 'session');
    const list = await qb.getMany();

    type SongCount = { artist_name: string; song_name: string; count: number };
    const songCount = new Map<string, SongCount>();
    const customSongCount = new Map<string, SongCount>();
    const sessionCount: Record<string, number> = {};

    for (const sub of list) {
      const sessionKey = `场次${sub.session_id}`;
      sessionCount[sessionKey] = (sessionCount[sessionKey] || 0) + 1;
      for (const song of sub.songs || []) {
        const key = JSON.stringify([song.artist_name, song.song_name]);
        const target = song.song_id ? songCount : customSongCount;
        const existing = target.get(key);
        target.set(key, { artist_name: song.artist_name, song_name: song.song_name, count: (existing?.count || 0) + 1 });
      }
    }

    const serialize = (counts: Map<string, SongCount>) => Array.from(counts.values()).sort((a, b) => b.count - a.count);
    return {
      hot_songs: serialize(songCount),
      custom_songs: serialize(customSongCount),
      session_stats: Object.entries(sessionCount).map(([session_name, count]) => ({ session_name, count })),
      total_submissions: list.length,
    };
  }

  @Get(':id')
  async findOne(@CurrentUser() user: ScopeUser, @Param('id') id: string) {
    const sub = await this.subRepo.findOne({ where: { id: +id }, relations: ['session', 'songs', 'user'] });
    if (!sub) throw new HttpException('投稿不存在', HttpStatus.NOT_FOUND);
    assertSessionOwned(sub.session, user);
    return {
      id: sub.id, user_id: sub.user_id, user_nickname: sub.user?.nickname || '',
      username: sub.user?.username || '', user_phone: sub.user?.phone || '',
      session_id: sub.session_id, session_name: sub.session?.name || '',
      status: sub.status, review_comment: sub.review_comment,
      songs: sub.songs?.sort((a, b) => a.sort_order - b.sort_order).map((song) => ({
        id: song.id, song_id: song.song_id, song_name: song.song_name,
        artist_name: song.artist_name, alt_title: song.alt_title, full_title: song.full_title,
        file_extension: song.file_extension, reference_url: song.reference_url,
        play_part: song.play_part, custom_part_desc: song.custom_part_desc, sort_order: song.sort_order,
      })) || [], created_at: sub.created_at, updated_at: sub.updated_at,
    };
  }

  @Put(':id/status')
  async updateStatus(@CurrentUser() user: ScopeUser, @Param('id') id: string, @Body() body: { status: string; review_comment?: string }) {
    const status = this.requireStatus(body.status);
    const reviewComment = body.review_comment || null;
    const sub = await this.subRepo.findOne({ where: { id: +id }, relations: ['session'] });
    if (!sub) throw new HttpException('投稿不存在', HttpStatus.NOT_FOUND);
    assertSessionOwned(sub.session, user);
    await this.subRepo.update(+id, { status, review_comment: reviewComment });
    return { id: +id, status, review_comment: reviewComment };
  }

  @Post('batch')
  async batchReview(@CurrentUser() user: ScopeUser, @Body() body: { ids: number[]; status: string; review_comment?: string }) {
    const ids = this.normalizeIds(body.ids);
    const status = this.requireStatus(body.status);
    await this.assertSubmissionsAccess(ids, user);
    const result = await this.subRepo.update(ids, { status, review_comment: body.review_comment || null });
    return { affected: result.affected ?? 0 };
  }

  @Delete('batch')
  async batchRemove(@CurrentUser() user: ScopeUser, @Body() body: { ids: number[] }) {
    const ids = this.normalizeIds(body.ids);
    await this.assertSubmissionsAccess(ids, user);
    const result = await this.subRepo.delete(ids);
    return { affected: result.affected ?? 0 };
  }

  @Delete(':id')
  async remove(@CurrentUser() user: ScopeUser, @Param('id') id: string) {
    const sub = await this.subRepo.findOne({ where: { id: +id }, relations: ['session'] });
    if (!sub) throw new HttpException('投稿不存在', HttpStatus.NOT_FOUND);
    assertSessionOwned(sub.session, user);
    await this.subRepo.delete(+id);
    return { id: +id };
  }
}
