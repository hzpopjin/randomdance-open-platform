import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoadshowRegistration } from './entities/roadshow-registration.entity';
import { RegistrationMember } from './entities/registration-member.entity';
import { Session } from '../sessions/entities/session.entity';
import { DeviceInfo, serializeDeviceInfo } from '../../common/utils/device-info.util';
import { createFormFingerprint, isUniqueConstraintError, normalizeFormText } from '../../common/utils/form-deduplication.util';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class RoadshowService {
  constructor(
    @InjectRepository(RoadshowRegistration) private regRepo: Repository<RoadshowRegistration>,
    @InjectRepository(RegistrationMember) private memberRepo: Repository<RegistrationMember>,
    @InjectRepository(Session) private sessionRepo: Repository<Session>,
  ) {}

  async create(userId: number, data: {
    session_id: number;
    song_name: string;
    artist_name: string;
    group_name: string;
    song_format: number;
    edited_file_url?: string;
    contact_phone: string;
    members: { member_name: string; position: string; sort_order: number }[];
    has_other_performance: number;
    other_performance_detail?: string;
    additional_requirements?: string;
  }, deviceInfo?: DeviceInfo) {
    const session = await this.sessionRepo.findOne({ where: { id: data.session_id } });
    if (!session) throw new HttpException('场次不存在', HttpStatus.NOT_FOUND);
    if (session.is_cancelled) throw new HttpException('该场次已取消，无法继续报名', HttpStatus.CONFLICT);

    const formFingerprint = createFormFingerprint({
      song_name: normalizeFormText(data.song_name),
      artist_name: normalizeFormText(data.artist_name),
      group_name: normalizeFormText(data.group_name),
      song_format: data.song_format,
      edited_file_url: normalizeFormText(data.edited_file_url),
      contact_phone: normalizeFormText(data.contact_phone),
      has_other_performance: data.has_other_performance,
      other_performance_detail: normalizeFormText(data.other_performance_detail),
      additional_requirements: normalizeFormText(data.additional_requirements),
      members: (data.members || []).map((m) => ({
        member_name: normalizeFormText(m.member_name),
        position: normalizeFormText(m.position),
        sort_order: m.sort_order,
      })),
    });

    const duplicateWhere = { user_id: userId, session_id: data.session_id, form_fingerprint: formFingerprint };
    const existing = await this.regRepo.findOne({ where: duplicateWhere });
    if (existing) return { id: existing.id };

    try {
      return await this.regRepo.manager.transaction(async (manager) => {
        // 仅普通读校验场次是否已取消，不再对 sessions 热点行加悲观读锁；
        // 并发重复提交由 form_fingerprint 唯一约束兜底（见下方 catch 分支）。
        const lockedSession = await manager.getRepository(Session).findOne({
          where: { id: data.session_id },
        });
        if (!lockedSession || lockedSession.is_cancelled) {
          throw new HttpException('该场次已取消，无法继续报名', HttpStatus.CONFLICT);
        }
        const registrationRepo = manager.getRepository(RoadshowRegistration);
        const memberRepo = manager.getRepository(RegistrationMember);
        const registration = registrationRepo.create({
          user_id: userId, session_id: data.session_id,
          song_name: data.song_name, artist_name: data.artist_name, group_name: data.group_name,
          song_format: data.song_format, edited_file_url: data.edited_file_url,
          contact_phone: data.contact_phone, has_other_performance: data.has_other_performance,
          other_performance_detail: data.other_performance_detail,
          additional_requirements: data.additional_requirements,
          device_info: deviceInfo ? serializeDeviceInfo(deviceInfo) : null,
          form_fingerprint: formFingerprint,
        });
        const saved = await registrationRepo.save(registration);
        if (data.members && data.members.length > 0) {
          const members = data.members.map((m) => memberRepo.create({
            registration_id: saved.id, member_name: m.member_name,
            position: m.position, sort_order: m.sort_order,
          }));
          await memberRepo.save(members);
        }
        return { id: saved.id };
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const dup = await this.regRepo.findOne({ where: duplicateWhere });
      if (!dup) throw error;
      return { id: dup.id };
    }
  }

  async findMine(userId: number, page = 1, page_size = 10) {
    const [list, total] = await this.regRepo.findAndCount({
      where: { user_id: userId }, relations: ['session', 'members'],
      order: { created_at: 'DESC' }, skip: (page - 1) * page_size, take: page_size,
    });
    return {
      list: list.map((r) => ({
        id: r.id, user_id: r.user_id, session_id: r.session_id,
        session_name: r.session?.name || '', song_name: r.song_name,
        artist_name: r.artist_name, group_name: r.group_name, song_format: r.song_format,
        contact_phone: r.contact_phone, has_other_performance: r.has_other_performance,
        member_count: r.members?.length || 0,
        status: ['pending', 'approved', 'rejected'][r.status] || 'pending',
        created_at: r.created_at, updated_at: r.updated_at,
      })), total, page, page_size,
    };
  }

  async findById(id: number, userId?: number, role?: UserRole) {
    const where: any = { id };
    if (userId && role !== UserRole.ADMIN) {
      where.user_id = userId;
    }
    const reg = await this.regRepo.findOne({ where, relations: ['session', 'members', 'user'] });
    if (!reg) throw new HttpException('报名不存在', HttpStatus.NOT_FOUND);
    const { user, ...rest } = reg;
    return {
      id: rest.id, user_id: rest.user_id, user_nickname: user?.nickname || '',
      session_id: rest.session_id, session_name: rest.session?.name || '',
      song_name: rest.song_name, artist_name: rest.artist_name, group_name: rest.group_name,
      song_format: rest.song_format, edited_file_url: rest.edited_file_url,
      contact_phone: rest.contact_phone, has_other_performance: rest.has_other_performance,
      other_performance_detail: rest.other_performance_detail,
      additional_requirements: rest.additional_requirements,
      status: ['pending', 'approved', 'rejected'][rest.status] || 'pending',
      review_comment: rest.review_comment, member_count: rest.members?.length || 0,
      members: rest.members?.map((m) => ({
        id: m.id, member_name: m.member_name, position: m.position, sort_order: m.sort_order,
      })) || [], created_at: rest.created_at, updated_at: rest.updated_at,
    };
  }
}
