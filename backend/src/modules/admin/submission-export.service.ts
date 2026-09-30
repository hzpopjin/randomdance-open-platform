import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Submission } from '../submissions/entities/submission.entity';
import { Session } from '../sessions/entities/session.entity';
import * as ExcelJS from 'exceljs';

@Injectable()
export class SubmissionExportService {
  constructor(
    @InjectRepository(Submission) private subRepo: Repository<Submission>,
    @InjectRepository(Session) private sessionRepo: Repository<Session>,
  ) {}

  async build(sessionId: number) {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('场次不存在');

    const submissions = await this.subRepo.find({
      where: { session_id: sessionId },
      relations: ['songs', 'user'],
      order: { created_at: 'ASC' },
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('网页投稿明细');
    const headers = ['用户', '歌曲数量', '自定义歌曲数', '状态', '歌曲明细', '投稿时间'];
    ws.addRow(headers);
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FE' } };

    submissions.forEach((sub) => {
      const songDetail = sub.songs?.map((s) => {
        const part = s.play_part === 0 ? '全曲' : s.play_part === 1 ? '副歌' : s.custom_part_desc || '自定义';
        return `${s.song_name} - ${s.artist_name} [${part}]${s.reference_url ? ` (${s.reference_url})` : ''}`;
      }).join('\n') || '';
      const statusMap = { pending: '待审核', approved: '已收录', rejected: '已拒绝' };
      ws.addRow([
        sub.user?.nickname || sub.user?.username || `用户#${sub.user_id}`,
        sub.songs?.length || 0,
        sub.songs?.filter((s) => !s.song_id).length || 0,
        statusMap[sub.status] || sub.status,
        songDetail,
        sub.created_at,
      ]);
    });

    ws.columns.forEach((col, i) => { col.width = i === 4 ? 60 : 18; });

    const ws2 = wb.addWorksheet('歌单汇总');
    ws2.addRow(['序号', '歌曲名', '歌手', '次要歌名', '播放段落', '参考链接', '是否自定义']);
    ws2.getRow(1).font = { bold: true };

    let idx = 1;
    for (const sub of submissions) {
      if (sub.status === 'rejected') continue;
      for (const song of sub.songs || []) {
        const part = song.play_part === 0 ? '全曲' : song.play_part === 1 ? '副歌' : song.custom_part_desc || '自定义';
        ws2.addRow([idx++, song.song_name, song.artist_name, song.alt_title || '', part, song.reference_url || '', song.song_id ? '否' : '是']);
      }
    }
    ws2.columns.forEach((col) => { col.width = 20; });

    const filename = `${session.name}_歌单投稿.xlsx`;
    const buffer = await wb.xlsx.writeBuffer();
    return { buffer: Buffer.from(buffer), filename };
  }
}
