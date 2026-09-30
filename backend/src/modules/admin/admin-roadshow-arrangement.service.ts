import { ConflictException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Session } from '../sessions/entities/session.entity';
import {
  RegistrationStatus,
  RoadshowRegistration,
} from '../roadshow/entities/roadshow-registration.entity';
import {
  RoadshowPosition,
  RoadshowPositionSection,
} from '../roadshow/entities/roadshow-position.entity';
import {
  RoadshowPositionEvent,
  RoadshowPositionEventAction,
} from '../roadshow/entities/roadshow-position-event.entity';
import {
  addMinutes,
  calculateRoadshowPositionCapacity,
} from '../roadshow/roadshow-position.utils';

interface ArrangementItem {
  registration_id: number;
  section: RoadshowPositionSection;
  position_no: number;
  locked: boolean;
}

@Injectable()
export class AdminRoadshowArrangementService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
    @InjectRepository(RoadshowRegistration)
    private readonly registrationRepo: Repository<RoadshowRegistration>,
    @InjectRepository(RoadshowPosition)
    private readonly positionRepo: Repository<RoadshowPosition>,
  ) {}

  async getArrangement(sessionId: number) {
    this.assertSessionId(sessionId);
    // 纯读：不再加悲观写锁、不再做 ensurePositions 写副作用（物化位次只在 PUT 保存时做）。
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new HttpException('场次不存在', HttpStatus.NOT_FOUND);
    return this.buildArrangement(sessionId);
  }

  async saveArrangement(
    sessionId: number,
    adminUserId: number,
    body: { expected_version?: string; items?: ArrangementItem[] },
  ) {
    this.assertSessionId(sessionId);
    if (!Array.isArray(body.items)) {
      throw new HttpException('请提供路演编排数据', HttpStatus.BAD_REQUEST);
    }

    const normalizedItems = body.items.map((item) => ({
      registration_id: Number(item.registration_id),
      section: item.section,
      position_no: Number(item.position_no),
      locked: !!item.locked,
    }));
    const requestedIds = normalizedItems.map((item) => item.registration_id);
    if (
      requestedIds.some((id) => !Number.isInteger(id) || id <= 0) ||
      new Set(requestedIds).size !== requestedIds.length ||
      normalizedItems.some((item) => !Object.values(RoadshowPositionSection).includes(item.section)) ||
      normalizedItems.some((item) => !Number.isInteger(item.position_no) || item.position_no <= 0) ||
      new Set(normalizedItems.map((item) => `${item.section}:${item.position_no}`)).size !== normalizedItems.length
    ) {
      throw new HttpException('编排数据中存在无效或重复的组', HttpStatus.BAD_REQUEST);
    }

    await this.positionRepo.manager.transaction(async (manager) => {
      const session = await manager.getRepository(Session).findOne({
        where: { id: sessionId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!session) throw new HttpException('场次不存在', HttpStatus.NOT_FOUND);

      const registrationRepo = manager.getRepository(RoadshowRegistration);
      const approved = await registrationRepo
        .createQueryBuilder('registration')
        .setLock('pessimistic_write')
        .where('registration.session_id = :sessionId', { sessionId })
        .andWhere('registration.status = :status', { status: RegistrationStatus.APPROVED })
        .orderBy('registration.id', 'ASC')
        .getMany();
      const capacity = calculateRoadshowPositionCapacity(approved.length);
      const requestedRegularCount = normalizedItems.filter((item) => item.section === RoadshowPositionSection.REGULAR).length;
      const requestedHalftimeCount = normalizedItems.filter((item) => item.section === RoadshowPositionSection.HALFTIME).length;
      await this.ensurePositions(manager, sessionId, capacity.regularCount, capacity.halftimeCount);

      let positions = await manager.getRepository(RoadshowPosition)
        .createQueryBuilder('position')
        .setLock('pessimistic_write')
        .where('position.session_id = :sessionId', { sessionId })
        .orderBy("CASE WHEN position.section = 'regular' THEN 0 ELSE 1 END", 'ASC')
        .addOrderBy('position.position_no', 'ASC')
        .getMany();

      // 自愈清空：对「已持久化但不再 approved」的位次做释放（写 ADMIN_CANCEL 事件），
      // 使其不再进入 buildArrangement 也不再触发 409 死循环。
      const approvedIdSet = new Set(approved.map((registration) => registration.id));
      const stalePositions = positions.filter(
        (position) => position.registration_id && !approvedIdSet.has(position.registration_id),
      );
      if (stalePositions.length > 0) {
        const staleEvents: Partial<RoadshowPositionEvent>[] = [];
        for (const stale of stalePositions) {
          const clearedAdminLocked = stale.admin_locked;
          await manager.getRepository(RoadshowPosition).update(stale.id, {
            registration_id: null,
            selected_by_user_id: null,
            selected_at: null,
            admin_locked: false,
          });
          staleEvents.push({
            session_id: sessionId,
            registration_id: stale.registration_id as number,
            position_id: stale.id,
            user_id: adminUserId,
            action: RoadshowPositionEventAction.ADMIN_CANCEL,
            device_info: null,
            cleared_admin_locked: clearedAdminLocked,
          });
          // 同步内存状态，避免后续 oldAssignments 重复计入已自愈的位次。
          stale.registration_id = null;
          stale.selected_by_user_id = null;
          stale.selected_at = null;
          stale.admin_locked = false;
        }
        await manager.getRepository(RoadshowPositionEvent).save(staleEvents);
      }

      const currentVersion = this.createVersion(approved, positions);
      if (body.expected_version && body.expected_version !== currentVersion) {
        throw new ConflictException('路演位次已被其他用户或管理员更新，请刷新后重试');
      }

      await this.ensurePositions(
        manager,
        sessionId,
        Math.max(capacity.regularCount, requestedRegularCount + capacity.reserveCount),
        Math.max(capacity.halftimeCount, requestedHalftimeCount + capacity.reserveCount),
      );
      positions = await manager.getRepository(RoadshowPosition)
        .createQueryBuilder('position')
        .setLock('pessimistic_write')
        .where('position.session_id = :sessionId', { sessionId })
        .orderBy("CASE WHEN position.section = 'regular' THEN 0 ELSE 1 END", 'ASC')
        .addOrderBy('position.position_no', 'ASC')
        .getMany();

      const approvedIds = new Set(approved.map((registration) => registration.id));
      if (requestedIds.some((id) => !approvedIds.has(id))) {
        throw new ConflictException('已通过的路演组数已变化，请刷新后重新编排');
      }

      const regularPositions = positions.filter((position) => position.section === RoadshowPositionSection.REGULAR);
      const halftimePositions = positions.filter((position) => position.section === RoadshowPositionSection.HALFTIME);
      const regularItems = normalizedItems.filter((item) => item.section === RoadshowPositionSection.REGULAR);
      const halftimeItems = normalizedItems.filter((item) => item.section === RoadshowPositionSection.HALFTIME);
      if (
        regularItems.some((item) => item.position_no > regularPositions.length) ||
        halftimeItems.some((item) => item.position_no > halftimePositions.length)
      ) {
        throw new HttpException('当前时段位次不足，请刷新后重试', HttpStatus.BAD_REQUEST);
      }

      const currentLocked = new Map(
        positions
          .filter((position) => position.registration_id && position.admin_locked)
          .map((position) => [position.registration_id as number, position]),
      );
      for (const [registrationId, lockedPosition] of currentLocked) {
        if (!requestedIds.includes(registrationId)) {
          throw new ConflictException(`第 ${lockedPosition.position_no} 组已锁定，请先解锁再移回待分配区`);
        }
      }
      for (const item of normalizedItems) {
        const lockedPosition = currentLocked.get(item.registration_id);
        if (
          lockedPosition && item.locked &&
          (lockedPosition.section !== item.section || lockedPosition.position_no !== item.position_no)
        ) {
          throw new ConflictException(`第 ${lockedPosition.position_no} 组已锁定，请先解锁再调整`);
        }
      }

      const oldAssignments = new Map(
        positions
          .filter((position) => position.registration_id)
          .map((position) => [position.id, position.registration_id as number]),
      );

      await manager.getRepository(RoadshowPosition)
        .createQueryBuilder()
        .update()
        .set({ registration_id: null, selected_by_user_id: null, selected_at: null, admin_locked: false })
        .where('session_id = :sessionId', { sessionId })
        .execute();

      const now = new Date();
      const positionMap = new Map(positions.map((position) => [`${position.section}:${position.position_no}`, position]));
      const assignments = normalizedItems.map((item) => {
        const key = `${item.section}:${item.position_no}`;
        const position = positionMap.get(key);
        // 校验 key 必须存在于 positionMap，去掉非空断言；position_no 空洞时抛 400。
        if (!position) {
          throw new HttpException(`位次 ${key} 不存在，请刷新后重试`, HttpStatus.BAD_REQUEST);
        }
        return { item, position };
      });
      const newAssignments = new Map<number, number>();
      for (const { item, position } of assignments) {
        await manager.getRepository(RoadshowPosition).update(position.id, {
          registration_id: item.registration_id,
          selected_by_user_id: adminUserId,
          selected_at: now,
          admin_locked: item.locked,
        });
        newAssignments.set(position.id, item.registration_id);
      }
      await this.ensureTrailingAvailablePositions(manager, sessionId);

      const eventRepo = manager.getRepository(RoadshowPositionEvent);
      const events: Partial<RoadshowPositionEvent>[] = [];
      for (const [positionId, registrationId] of oldAssignments) {
        if (newAssignments.get(positionId) !== registrationId) {
          events.push({
            session_id: sessionId,
            registration_id: registrationId,
            position_id: positionId,
            user_id: adminUserId,
            action: RoadshowPositionEventAction.ADMIN_CANCEL,
            device_info: null,
          });
        }
      }
      for (const [positionId, registrationId] of newAssignments) {
        if (oldAssignments.get(positionId) !== registrationId) {
          events.push({
            session_id: sessionId,
            registration_id: registrationId,
            position_id: positionId,
            user_id: adminUserId,
            action: RoadshowPositionEventAction.ADMIN_ASSIGN,
            device_info: null,
          });
        }
      }
      if (events.length > 0) await eventRepo.save(events);

      const physicalOrder = [...normalizedItems].sort((left, right) =>
        this.sectionRank(left.section) - this.sectionRank(right.section) || left.position_no - right.position_no,
      );
      const unassignedIds = approved
        .map((registration) => registration.id)
        .filter((registrationId) => !requestedIds.includes(registrationId));
      if (unassignedIds.length > 0) {
        await registrationRepo
          .createQueryBuilder()
          .update()
          .set({ sort_order: null })
          .whereInIds(unassignedIds)
          .execute();
      }
      for (let index = 0; index < physicalOrder.length; index += 1) {
        await registrationRepo.update(physicalOrder[index].registration_id, {
          sort_order: index + 1,
        });
      }
    });

    return this.buildArrangement(sessionId);
  }

  private async buildArrangement(sessionId: number) {
    const [session, registrations, positions] = await Promise.all([
      this.sessionRepo.findOne({ where: { id: sessionId } }),
      this.registrationRepo.find({
        where: { session_id: sessionId },
        relations: ['members', 'user'],
        order: { created_at: 'ASC', id: 'ASC' },
      }),
      this.positionRepo.find({
        where: { session_id: sessionId },
        relations: ['registration'],
        order: { position_no: 'ASC' },
      }),
    ]);
    if (!session) throw new HttpException('场次不存在', HttpStatus.NOT_FOUND);

    positions.sort((left, right) => this.sectionRank(left.section) - this.sectionRank(right.section) || left.position_no - right.position_no);
    const approved = registrations.filter((registration) => registration.status === RegistrationStatus.APPROVED);
    const approvedIds = new Set(approved.map((registration) => registration.id));
    // 纯读视图：将「已持久化但不再 approved」的陈旧位次视为未分配，
    // 与 saveArrangement 自愈后的状态、createVersion 保持一致，避免陈旧报名进入编排页。
    const assignedRegistrationId = (position: RoadshowPosition): number | null =>
      position.registration_id && approvedIds.has(position.registration_id) ? position.registration_id : null;
    const calculated = calculateRoadshowPositionCapacity(approved.length);
    const assignedHalftimeCount = positions.filter((position) =>
      position.section === RoadshowPositionSection.HALFTIME && assignedRegistrationId(position),
    ).length;
    const plannedRegularCount = Math.max(0, approved.length - assignedHalftimeCount);
    const occupiedRegularMax = Math.max(0, ...positions.filter((position) =>
      position.section === RoadshowPositionSection.REGULAR && assignedRegistrationId(position),
    ).map((position) => position.position_no));
    const occupiedHalftimeMax = Math.max(0, ...positions.filter((position) =>
      position.section === RoadshowPositionSection.HALFTIME && assignedRegistrationId(position),
    ).map((position) => position.position_no));
    const regularCount = Math.max(plannedRegularCount + calculated.reserveCount, occupiedRegularMax);
    const halftimeCount = Math.max(assignedHalftimeCount + calculated.reserveCount, occupiedHalftimeMax);
    const slotMinutes = this.positiveInt(session.roadshow_slot_minutes, 5);
    const halftimeDelayMinutes = this.nonNegativeInt(session.roadshow_halftime_delay_minutes, 60);
    const assignedIds = new Set(
      positions.map((position) => assignedRegistrationId(position)).filter((value): value is number => Boolean(value)),
    );
    const registrationMap = new Map(registrations.map((registration) => [registration.id, registration]));

    return {
      session: {
        id: session.id,
        name: session.name,
        event_date: session.event_date,
        location: session.location,
        selection_enabled: !!session.roadshow_selection_enabled,
        selection_open_at: session.roadshow_selection_open_at,
        slot_minutes: slotMinutes,
        halftime_delay_minutes: halftimeDelayMinutes,
        is_cancelled: !!session.is_cancelled,
      },
      version: this.createVersion(approved, positions),
      counts: {
        total_registration_count: registrations.length,
        approved_count: approved.length,
        pending_count: registrations.filter((registration) => registration.status === RegistrationStatus.PENDING).length,
        rejected_count: registrations.filter((registration) => registration.status === RegistrationStatus.REJECTED).length,
        selected_count: assignedIds.size,
        unselected_count: approved.filter((registration) => !assignedIds.has(registration.id)).length,
        reserve_count: calculated.reserveCount,
        regular_position_count: regularCount,
        halftime_position_count: halftimeCount,
      },
      positions: positions.filter((position) =>
        assignedRegistrationId(position) ||
        (position.section === RoadshowPositionSection.REGULAR
          ? position.position_no <= regularCount
          : position.position_no <= halftimeCount),
      ).map((position) => {
        const effectiveRegistrationId = assignedRegistrationId(position);
        return {
          id: position.id,
          section: position.section,
          position_no: position.position_no,
          reference_time: this.positionTime(session, position, plannedRegularCount, slotMinutes, halftimeDelayMinutes),
          selected_at: effectiveRegistrationId ? position.selected_at : null,
          locked: effectiveRegistrationId ? !!position.admin_locked : false,
          registration: effectiveRegistrationId
            ? this.registrationView(registrationMap.get(effectiveRegistrationId) || position.registration!)
            : null,
        };
      }),
      unassigned_registrations: approved
        .filter((registration) => !assignedIds.has(registration.id))
        .map((registration) => this.registrationView(registration)),
    };
  }

  private async ensurePositions(manager: EntityManager, sessionId: number, regularTarget: number, halftimeTarget: number) {
    const repo = manager.getRepository(RoadshowPosition);
    const existing = await repo.find({ where: { session_id: sessionId } });
    const maxRegular = Math.max(0, ...existing.filter((position) => position.section === RoadshowPositionSection.REGULAR).map((position) => position.position_no));
    const maxHalftime = Math.max(0, ...existing.filter((position) => position.section === RoadshowPositionSection.HALFTIME).map((position) => position.position_no));
    const additions: RoadshowPosition[] = [];
    for (let no = maxRegular + 1; no <= regularTarget; no += 1) {
      additions.push(repo.create({ session_id: sessionId, section: RoadshowPositionSection.REGULAR, position_no: no }));
    }
    for (let no = maxHalftime + 1; no <= halftimeTarget; no += 1) {
      additions.push(repo.create({ session_id: sessionId, section: RoadshowPositionSection.HALFTIME, position_no: no }));
    }
    if (additions.length > 0) await repo.save(additions);
  }

  private async ensureTrailingAvailablePositions(manager: EntityManager, sessionId: number) {
    const repo = manager.getRepository(RoadshowPosition);
    const positions = await repo.find({
      where: { session_id: sessionId },
      order: { position_no: 'ASC' },
    });
    const additions: RoadshowPosition[] = [];
    for (const section of [RoadshowPositionSection.REGULAR, RoadshowPositionSection.HALFTIME]) {
      const sectionPositions = positions.filter((position) => position.section === section);
      const tail = sectionPositions[sectionPositions.length - 1];
      const hasAvailablePosition = sectionPositions.some((position) => !position.registration_id);
      if (tail?.registration_id && !hasAvailablePosition) {
        additions.push(repo.create({
          session_id: sessionId,
          section,
          position_no: tail.position_no + 1,
          registration_id: null,
          selected_by_user_id: null,
          selected_at: null,
          admin_locked: false,
        }));
      }
    }
    if (additions.length > 0) await repo.save(additions);
  }

  private registrationView(registration: RoadshowRegistration) {
    return {
      id: registration.id,
      group_name: registration.group_name,
      song_name: registration.song_name,
      artist_name: registration.artist_name,
      additional_requirements: registration.additional_requirements || null,
      // 与其它路演接口保持一致：数字枚举序列化为字符串（前端据此过滤非 approved 报名）。
      status: (['pending', 'approved', 'rejected'] as const)[registration.status] || 'pending',
      owner_username: registration.user?.username || registration.user?.nickname || '',
      owner_uid: registration.user_id,
      owner_user_id: registration.user_id,
      member_count: registration.members?.length || 0,
      sort_order: registration.sort_order,
      created_at: registration.created_at,
    };
  }

  private createVersion(approved: RoadshowRegistration[], positions: RoadshowPosition[]) {
    const approvedIds = new Set(approved.map((registration) => registration.id));
    return [
      approved.map((registration) => registration.id).sort((a, b) => a - b).join(','),
      // 版本号排除「不再 approved」的陈旧占用，使 getArrangement（纯读、未自愈）
      // 与 saveArrangement（自愈后）计算出一致的 version，避免陈旧位次触发版本冲突 409。
      positions.map((position) => {
        const assigned = position.registration_id && approvedIds.has(position.registration_id);
        return `${position.id}:${assigned ? position.registration_id : 0}:${assigned && position.admin_locked ? 1 : 0}`;
      }).join(','),
    ].join('|');
  }

  private positionTime(session: Session, position: RoadshowPosition, regularTimelineGroupCount: number, slotMinutes: number, halftimeDelayMinutes: number) {
    const offset = position.section === RoadshowPositionSection.REGULAR
      ? (position.position_no - 1) * slotMinutes
      : regularTimelineGroupCount * slotMinutes + halftimeDelayMinutes + (position.position_no - 1) * slotMinutes;
    return addMinutes(session.event_date, offset)?.toISOString() || null;
  }

  private assertSessionId(sessionId: number) {
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      throw new HttpException('场次 ID 无效', HttpStatus.BAD_REQUEST);
    }
  }

  private sectionRank(section: RoadshowPositionSection) {
    return section === RoadshowPositionSection.REGULAR ? 0 : 1;
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
