import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoadshowRegistration, RegistrationStatus } from '../roadshow/entities/roadshow-registration.entity';
import { RegistrationMember } from '../roadshow/entities/registration-member.entity';
import { RoadshowPosition, RoadshowPositionSection } from '../roadshow/entities/roadshow-position.entity';
import { Session } from '../sessions/entities/session.entity';
import { RoadshowMediaService } from '../roadshow/roadshow-media.service';
import { addMinutes } from '../roadshow/roadshow-position.utils';
import * as ExcelJS from 'exceljs';

@Injectable()
export class RoadshowExportService {
  constructor(
    @InjectRepository(RoadshowRegistration) private regRepo: Repository<RoadshowRegistration>,
    @InjectRepository(RegistrationMember) private memberRepo: Repository<RegistrationMember>,
    @InjectRepository(Session) private sessionRepo: Repository<Session>,
    @InjectRepository(RoadshowPosition) private positionRepo: Repository<RoadshowPosition>,
    private readonly mediaService: RoadshowMediaService,
  ) {}

  async build(sessionId: number, status?: string) {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('场次不存在');

    const qb = this.regRepo.createQueryBuilder('r')
      .leftJoinAndSelect('r.session', 'session')
      .leftJoinAndSelect('r.user', 'user')
      .leftJoinAndSelect('r.members', 'members')
      .leftJoinAndSelect('r.position', 'position')
      .where('r.session_id = :sessionId', { sessionId });

    if (status !== undefined && status !== '') {
      const statusMap: Record<string, number> = { pending: 0, approved: 1, rejected: 2 };
      const statusValue = statusMap[status] ?? Number(status);
      qb.andWhere('r.status = :status', { status: statusValue });
    }

    // Sort by sort_order (nulls last) then by id
    qb.orderBy('r.sort_order IS NULL', 'ASC')
      .addOrderBy('r.sort_order', 'ASC')
      .addOrderBy('r.id', 'ASC');

    const registrations = await qb.getMany();

    // 预计时间算法复用编排的 positionTime：普通区 (no-1)*slot；
    // 中场 plannedRegularCount*slot + halftime_delay + (no-1)*slot；基准 session.event_date。
    const slotMinutes = this.positiveInt(session.roadshow_slot_minutes, 5);
    const halftimeDelayMinutes = this.nonNegativeInt(session.roadshow_halftime_delay_minutes, 60);
    const [sessionPositions, approvedCount] = await Promise.all([
      this.positionRepo.find({ where: { session_id: sessionId } }),
      this.regRepo.count({ where: { session_id: sessionId, status: RegistrationStatus.APPROVED } }),
    ]);
    const assignedHalftimeCount = sessionPositions.filter((position) =>
      position.section === RoadshowPositionSection.HALFTIME && position.registration_id,
    ).length;
    const plannedRegularCount = Math.max(0, approvedCount - assignedHalftimeCount);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('路演报名');
    const headers = ['序号', '选位标签', '预计时间', '路演歌曲', '组合名', '音乐类型', '音乐', '审核视频', '对接人', '联系方式', '负责人联系方式', '路演人数', '路演成员表', '成员路演情况', '其他需求'];
    ws.addRow(headers);
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FE' } };

    let insertedHalftimeSeparator = false;
    let displayIndex = 0;

    for (const reg of registrations) {
      // Insert halftime separator row before first halftime registration
      const isHalftime = reg.position?.section === RoadshowPositionSection.HALFTIME;
      if (isHalftime && !insertedHalftimeSeparator) {
        insertedHalftimeSeparator = true;
        const separatorRow = ws.addRow(['——— 中场 ———']);
        separatorRow.font = { bold: true, italic: true };
        separatorRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
      }

      displayIndex += 1;
      const musicType = reg.song_format === 0 ? '原版' : '自己剪辑';

      // 音乐/审核视频两列改写签名 access_url（TOS 托管时）；本地 /uploads 或非托管时回退原始 URL。
      const signed = await this.mediaService.signedUrls(reg, false);
      const musicLink = signed.audio_access_url || reg.edited_file_url || '';
      const reviewVideoLink = signed.review_video_access_url || reg.review_video_url || '';

      const memberStr = reg.members?.map((m) => `${m.member_name}(${m.position || '-'})`).join(', ') || '';
      const positionLabel = reg.position
        ? `${reg.position.section === RoadshowPositionSection.REGULAR ? '普通' : '中场'} ${reg.position.position_no}`
        : '';
      const expectedTime = reg.position
        ? this.formatExpectedTime(session, reg.position, plannedRegularCount, slotMinutes, halftimeDelayMinutes)
        : '';

      ws.addRow([
        displayIndex, positionLabel, expectedTime, reg.song_name, reg.group_name, musicType,
        musicLink || '-', reviewVideoLink || '-',
        reg.user?.nickname || '', reg.contact_phone, reg.contact_phone,
        reg.members?.length || 0, memberStr, reg.other_performance_detail || '',
        reg.additional_requirements || '',
      ]);
    }

    ws.columns.forEach((col) => { col.width = 18; });
    ws.getColumn(4).width = 28;
    ws.getColumn(13).width = 36;
    ws.getColumn(15).width = 36;

    const filename = `${session.name}_路演报名表.xlsx`;
    const buffer = await wb.xlsx.writeBuffer();
    return { buffer: Buffer.from(buffer), filename };
  }

  private formatExpectedTime(
    session: Session,
    position: RoadshowPosition,
    plannedRegularCount: number,
    slotMinutes: number,
    halftimeDelayMinutes: number,
  ) {
    const offset = position.section === RoadshowPositionSection.REGULAR
      ? (position.position_no - 1) * slotMinutes
      : plannedRegularCount * slotMinutes + halftimeDelayMinutes + (position.position_no - 1) * slotMinutes;
    const referenceTime = addMinutes(session.event_date, offset);
    if (!referenceTime) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${referenceTime.getFullYear()}-${pad(referenceTime.getMonth() + 1)}-${pad(referenceTime.getDate())} ` +
      `${pad(referenceTime.getHours())}:${pad(referenceTime.getMinutes())}`;
  }

  private positiveInt(value: number, fallback: number) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  private nonNegativeInt(value: number, fallback: number) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
  }
}
