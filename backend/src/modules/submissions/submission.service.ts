import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Submission } from './entities/submission.entity';
import { SubmissionSong } from './entities/submission-song.entity';
import { Session } from '../sessions/entities/session.entity';
import { DeviceInfo, serializeDeviceInfo } from '../../common/utils/device-info.util';
import { createFormFingerprint, isUniqueConstraintError, normalizeFormText } from '../../common/utils/form-deduplication.util';

@Injectable()
export class SubmissionService {
  constructor(
    @InjectRepository(Submission) private subRepo: Repository<Submission>,
    @InjectRepository(SubmissionSong) private songRepo: Repository<SubmissionSong>,
    @InjectRepository(Session) private sessionRepo: Repository<Session>,
  ) {}

  async create(userId: number, data: {
    session_id: number;
    songs: Array<{
      song_id?: number; song_name: string; artist_name: string;
      alt_title?: string; full_title?: string; file_extension?: string;
      full_file_path?: string; chorus_file_path?: string; reference_url?: string;
      play_part: number; custom_part_desc?: string; sort_order?: number;
    }>;
  }, deviceInfo?: DeviceInfo) {
    const session = await this.sessionRepo.findOne({ where: { id: data.session_id } });
    if (!session) throw new HttpException('场次不存在', HttpStatus.NOT_FOUND);
    if (session.is_cancelled) throw new HttpException('该场次已取消，无法继续投稿', HttpStatus.CONFLICT);
    if (!data.songs || data.songs.length === 0) throw new HttpException('至少需要选择一首歌曲', HttpStatus.BAD_REQUEST);

    const formFingerprint = createFormFingerprint({
      songs: data.songs.map((song, index) => ({
        song_id: song.song_id ?? null,
        song_name: normalizeFormText(song.song_name),
        artist_name: normalizeFormText(song.artist_name),
        alt_title: normalizeFormText(song.alt_title),
        full_title: normalizeFormText(song.full_title),
        file_extension: normalizeFormText(song.file_extension),
        full_file_path: normalizeFormText(song.full_file_path),
        chorus_file_path: normalizeFormText(song.chorus_file_path),
        reference_url: normalizeFormText(song.reference_url),
        play_part: song.play_part,
        custom_part_desc: normalizeFormText(song.custom_part_desc),
        sort_order: song.sort_order ?? index,
      })),
    });

    const duplicateWhere = { user_id: userId, session_id: data.session_id, form_fingerprint: formFingerprint };
    const existing = await this.subRepo.findOne({ where: duplicateWhere });
    if (existing) return { id: existing.id };

    try {
      return await this.subRepo.manager.transaction(async (manager) => {
        const lockedSession = await manager.getRepository(Session).findOne({
          where: { id: data.session_id }, lock: { mode: 'pessimistic_read' },
        });
        if (!lockedSession || lockedSession.is_cancelled) {
          throw new HttpException('该场次已取消，无法继续投稿', HttpStatus.CONFLICT);
        }
        const submissionRepo = manager.getRepository(Submission);
        const songRepo = manager.getRepository(SubmissionSong);
        const submission = submissionRepo.create({
          user_id: userId, session_id: data.session_id,
          device_info: deviceInfo ? serializeDeviceInfo(deviceInfo) : null,
          form_fingerprint: formFingerprint,
        });
        const saved = await submissionRepo.save(submission);
        const submissionSongs = data.songs.map((song, index) => songRepo.create({
          submission_id: saved.id, song_id: song.song_id,
          song_name: song.song_name, artist_name: song.artist_name,
          alt_title: song.alt_title, full_title: song.full_title,
          file_extension: song.file_extension, full_file_path: song.full_file_path,
          chorus_file_path: song.chorus_file_path, reference_url: song.reference_url,
          play_part: song.play_part, custom_part_desc: song.custom_part_desc,
          sort_order: song.sort_order ?? index,
        }));
        await songRepo.save(submissionSongs);
        return { id: saved.id };
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const dup = await this.subRepo.findOne({ where: duplicateWhere });
      if (!dup) throw error;
      return { id: dup.id };
    }
  }

  async findMine(userId: number, page = 1, page_size = 10) {
    const [list, total] = await this.subRepo.findAndCount({
      where: { user_id: userId }, relations: ['session', 'songs'],
      order: { created_at: 'DESC' }, skip: (page - 1) * page_size, take: page_size,
    });
    return {
      list: list.map((s) => ({
        id: s.id, user_id: s.user_id, session_id: s.session_id,
        session_name: s.session?.name || '', status: s.status,
        song_count: s.songs?.length || 0, created_at: s.created_at, updated_at: s.updated_at,
      })), total, page, page_size,
    };
  }

  async findById(id: number, userId?: number) {
    const where: any = { id };
    if (userId !== undefined) where.user_id = userId;
    const sub = await this.subRepo.findOne({ where, relations: ['session', 'songs', 'user'] });
    if (!sub) throw new HttpException('投稿不存在', HttpStatus.NOT_FOUND);
    return {
      id: sub.id, user_id: sub.user_id, user_nickname: sub.user?.nickname || '',
      session_id: sub.session_id, session_name: sub.session?.name || '',
      status: sub.status, review_comment: sub.review_comment,
      songs: sub.songs?.sort((a, b) => a.sort_order - b.sort_order).map((song) => ({
        id: song.id, song_id: song.song_id, song_name: song.song_name,
        artist_name: song.artist_name, alt_title: song.alt_title,
        full_title: song.full_title, play_part: song.play_part,
        custom_part_desc: song.custom_part_desc, reference_url: song.reference_url,
        sort_order: song.sort_order,
      })) || [], created_at: sub.created_at, updated_at: sub.updated_at,
    };
  }
}
