import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from './entities/session.entity';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session)
    private sessionRepo: Repository<Session>,
  ) {}

  async findAllPublic(organizerId?: number) {
    const params: any[] = [];
    let organizerFilter = '';
    if (organizerId !== undefined && organizerId !== null && !Number.isNaN(organizerId)) {
      organizerFilter = 'AND s.organizer_id = ?';
      params.push(organizerId);
    }
    const rows = await this.sessionRepo.query(
      `SELECT s.*, o.organizer_name AS organizer_name,
        (SELECT COUNT(*) FROM submissions WHERE session_id = s.id) as submission_count,
        (SELECT COUNT(*) FROM roadshow_registrations WHERE session_id = s.id) as registration_count
      FROM sessions s
      LEFT JOIN users o ON o.id = s.organizer_id
      WHERE s.is_cancelled = 0
      ${organizerFilter}
      ORDER BY s.event_date DESC`,
      params,
    );
    return { list: rows, total: rows.length };
  }

  async findOne(id: number) {
    const rows = await this.sessionRepo.query(
      `SELECT s.*, o.organizer_name AS organizer_name
      FROM sessions s
      LEFT JOIN users o ON o.id = s.organizer_id
      WHERE s.id = ?`,
      [id],
    );
    const session = rows[0];
    if (!session) throw new NotFoundException('场次不存在');
    // 原生 SQL 下 mysql2 对 tinyint(1) 返回 0/1，此处显式归一为 boolean，
    // 保持与 findOne 走 repository 时一致的对外契约（entity 中仅这两列为 boolean）。
    return {
      ...session,
      is_cancelled: !!session.is_cancelled,
      roadshow_selection_enabled: !!session.roadshow_selection_enabled,
    };
  }
}
