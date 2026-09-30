import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Session } from '../sessions/entities/session.entity';
import { RoadshowRegistration } from '../roadshow/entities/roadshow-registration.entity';
import { Submission } from '../submissions/entities/submission.entity';
import { Song } from '../songs/entities/song.entity';
import { SystemLog } from '../system-logs/entities/system-log.entity';
import { ClientEvent } from '../client-events/entities/client-event.entity';
import dayjs from 'dayjs';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Session) private sessionRepo: Repository<Session>,
    @InjectRepository(RoadshowRegistration) private regRepo: Repository<RoadshowRegistration>,
    @InjectRepository(Submission) private subRepo: Repository<Submission>,
    @InjectRepository(Song) private songRepo: Repository<Song>,
    @InjectRepository(SystemLog) private logRepo: Repository<SystemLog>,
    @InjectRepository(ClientEvent) private eventRepo: Repository<ClientEvent>,
  ) {}

  @Get()
  async getStats() {
    const now = dayjs();
    const sevenDaysAgo = now.subtract(7, 'day').toDate();
    const twentyFourHoursAgo = now.subtract(24, 'hour').toDate();

    const [totalUsers, usersLast7Days, totalRegistrations, totalSubmissions, activeSessions, pendingRegs, pendingSubs, pendingSongs, requestCount, errorCount, clientEvents24h] = await Promise.all([
      this.userRepo.count(),
      this.userRepo.createQueryBuilder('u').where('u.created_at >= :date', { date: sevenDaysAgo }).getCount(),
      this.regRepo.count(),
      this.subRepo.count(),
      this.sessionRepo.count({ where: { is_cancelled: false } }),
      this.regRepo.count({ where: { status: 0 } }),
      this.subRepo.count({ where: { status: 'pending' as any } }),
      this.songRepo.count({ where: { status: 0 } }),
      this.logRepo.createQueryBuilder('l').where('l.created_at >= :date', { date: twentyFourHoursAgo }).andWhere('l.type = :type', { type: 'api_request' }).getCount(),
      this.logRepo.createQueryBuilder('l').where('l.created_at >= :date', { date: twentyFourHoursAgo }).andWhere('l.level IN (:...levels)', { levels: ['error', 'warn'] }).getCount(),
      this.eventRepo.createQueryBuilder('e').where('e.received_at >= :date', { date: twentyFourHoursAgo }).getCount(),
    ]);

    const trendStart = now.subtract(13, 'day').format('YYYY-MM-DD');
    const [regTrend, subTrend] = await Promise.all([
      this.regRepo.createQueryBuilder('r')
        .select(`DATE_FORMAT(r.created_at, '%Y-%m-%d')`, 'day')
        .addSelect('COUNT(*)', 'count')
        .where('r.created_at >= :start', { start: trendStart })
        .groupBy(`DATE_FORMAT(r.created_at, '%Y-%m-%d')`)
        .orderBy('day', 'ASC').getRawMany(),
      this.subRepo.createQueryBuilder('s')
        .select(`DATE_FORMAT(s.created_at, '%Y-%m-%d')`, 'day')
        .addSelect('COUNT(*)', 'count')
        .where('s.created_at >= :start', { start: trendStart })
        .groupBy(`DATE_FORMAT(s.created_at, '%Y-%m-%d')`)
        .orderBy('day', 'ASC').getRawMany(),
    ]);

    const regMap = new Map(regTrend.map((r: any) => [r.day, Number(r.count || 0)]));
    const subMap = new Map(subTrend.map((r: any) => [r.day, Number(r.count || 0)]));
    const trend = Array.from({ length: 14 }, (_, i) => {
      const day = now.subtract(13 - i, 'day').format('YYYY-MM-DD');
      return { date: day, registrations: regMap.get(day) || 0, submissions: subMap.get(day) || 0 };
    });

    const recentRegs = await this.regRepo.find({ relations: ['session', 'user'], order: { created_at: 'DESC' }, take: 3 });
    const recentSubs = await this.subRepo.find({ relations: ['session', 'user'], order: { created_at: 'DESC' }, take: 3 });
    const recentActivity = [
      ...recentRegs.map((r) => ({
        id: `reg-${r.id}`, type: 'registration' as const,
        title: r.song_name, description: r.session?.name || '',
        status: ['pending', 'approved', 'rejected'][r.status] as any,
        created_at: r.created_at,
      })),
      ...recentSubs.map((s) => ({
        id: `sub-${s.id}`, type: 'submission' as const,
        title: s.user?.nickname || `用户#${s.user_id}`,
        description: s.session?.name || '', status: s.status as any,
        created_at: s.created_at,
      })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6);

    const upcomingSessions = await this.sessionRepo.find({
      where: { is_cancelled: false }, order: { event_date: 'DESC' }, take: 5,
    });

    return {
      summary: {
        total_users: totalUsers, users_last_7_days: usersLast7Days,
        total_registrations: totalRegistrations, registrations_last_7_days: trend.reduce((s, t) => s + t.registrations, 0),
        total_submissions: totalSubmissions, submissions_last_7_days: trend.reduce((s, t) => s + t.submissions, 0),
        active_sessions: activeSessions,
      },
      pending: { registrations: pendingRegs, submissions: pendingSubs, songs: pendingSongs },
      trend,
      upcoming_sessions: upcomingSessions,
      recent_activity: recentActivity,
      system_health: {
        requests_24h: requestCount, errors_24h: errorCount,
        client_events_24h: clientEvents24h,
        error_rate: requestCount > 0 ? Number(((errorCount / requestCount) * 100).toFixed(2)) : 0,
      },
      generated_at: new Date().toISOString(),
    };
  }
}
