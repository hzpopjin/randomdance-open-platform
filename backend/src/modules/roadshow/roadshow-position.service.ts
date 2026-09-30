import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { DeviceInfo, serializeDeviceInfo } from '../../common/utils/device-info.util';
import { isUniqueConstraintError } from '../../common/utils/form-deduplication.util';
import { Session } from '../sessions/entities/session.entity';
import { RegistrationStatus, RoadshowRegistration } from './entities/roadshow-registration.entity';
import {
  RoadshowPosition,
  RoadshowPositionSection,
} from './entities/roadshow-position.entity';
import {
  RoadshowPositionEvent,
  RoadshowPositionEventAction,
} from './entities/roadshow-position-event.entity';
import { addMinutes, calculateRoadshowPositionCapacity } from './roadshow-position.utils';

type SelectionState = 'disabled' | 'not_configured' | 'not_open' | 'open' | 'cancelled';

@Injectable()
export class RoadshowPositionService {
  constructor(
    @InjectRepository(RoadshowRegistration)
    private readonly registrationRepo: Repository<RoadshowRegistration>,
    @InjectRepository(RoadshowPosition)
    private readonly positionRepo: Repository<RoadshowPosition>,
  ) {}

  async getBoard(userId: number, registrationId: number) {
    const registration = await this.findOwnedRegistration(userId, registrationId);
    const session = registration.session;
    const selectionState = this.getSelectionState(session);

    let approvedRegistrationCount: number;
    let calculatedCapacity: ReturnType<typeof calculateRoadshowPositionCapacity>;
    let positions: RoadshowPosition[] = [];

    if (selectionState !== 'cancelled') {
      // 补位放入独立短事务：先取 Session 写锁（保持 Session→... 锁顺序不变），
      // 锁内再统计 approved 容量并物化位次；读取 positions 改为事务外无锁 find，
      // 避免读路径长时间持写锁。
      const ensured = await this.positionRepo.manager.transaction(async (manager) => {
        const lockedSession = await manager.getRepository(Session).findOne({
          where: { id: session.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!lockedSession) {
          throw new HttpException('场次不存在', HttpStatus.NOT_FOUND);
        }
        const count = await manager.getRepository(RoadshowRegistration).count({
          where: { session_id: lockedSession.id, status: RegistrationStatus.APPROVED },
        });
        const capacity = calculateRoadshowPositionCapacity(count);
        await this.ensurePositions(manager, lockedSession.id, capacity.regularCount, capacity.halftimeCount);
        await this.ensureTrailingAvailablePositions(
          manager,
          lockedSession.id,
          capacity.regularCount,
          capacity.halftimeCount,
        );
        return { count, capacity };
      });
      approvedRegistrationCount = ensured.count;
      calculatedCapacity = ensured.capacity;
      positions = await this.positionRepo.find({
        where: { session_id: session.id },
        relations: { registration: true },
        order: { section: 'ASC', position_no: 'ASC' },
      });
    } else {
      approvedRegistrationCount = await this.registrationRepo.count({
        where: { session_id: session.id, status: RegistrationStatus.APPROVED },
      });
      calculatedCapacity = calculateRoadshowPositionCapacity(approvedRegistrationCount);
      positions = await this.positionRepo.find({
        where: { session_id: session.id },
        relations: { registration: true },
      });
    }
    positions.sort((left, right) => {
      const sectionDiff = this.sectionRank(left.section) - this.sectionRank(right.section);
      return sectionDiff || left.position_no - right.position_no;
    });
    positions = this.visiblePositions(
      positions,
      calculatedCapacity.regularCount,
      calculatedCapacity.halftimeCount,
    );
    const assignedHalftimeCount = positions.filter((position) =>
      position.section === RoadshowPositionSection.HALFTIME && position.registration_id,
    ).length;
    const regularTimelineGroupCount = Math.max(0, approvedRegistrationCount - assignedHalftimeCount);

    const regularCount = Math.max(
      calculatedCapacity.regularCount,
      ...positions
        .filter((position) => position.section === RoadshowPositionSection.REGULAR)
        .map((position) => position.position_no),
    );
    const halftimeCount = Math.max(
      calculatedCapacity.halftimeCount,
      ...positions
        .filter((position) => position.section === RoadshowPositionSection.HALFTIME)
        .map((position) => position.position_no),
    );
    const slotMinutes = this.positiveInt(session.roadshow_slot_minutes, 5);
    const halftimeDelayMinutes = this.nonNegativeInt(session.roadshow_halftime_delay_minutes, 60);
    const described = positions.map((position) =>
      this.describePosition(
        position,
        registration.id,
        session.event_date,
        regularTimelineGroupCount,
        slotMinutes,
        halftimeDelayMinutes,
      ),
    );

    return {
      registration: {
        id: registration.id,
        group_name: registration.group_name,
        song_name: registration.song_name,
        artist_name: registration.artist_name,
        status: this.registrationStatusName(registration.status),
        eligible: registration.status === RegistrationStatus.APPROVED,
      },
      session: {
        id: session.id,
        name: session.name,
        event_date: session.event_date,
        location: session.location,
        selection_enabled: !!session.roadshow_selection_enabled,
        selection_open_at: session.roadshow_selection_open_at,
        slot_minutes: slotMinutes,
        halftime_delay_minutes: halftimeDelayMinutes,
      },
      selection_state: selectionState,
      selection_state_message: this.selectionStateMessage(selectionState, session),
      server_time: new Date().toISOString(),
      capacity: {
        approved_registration_count: approvedRegistrationCount,
        reserve_count: calculatedCapacity.reserveCount,
        calculated_regular_count: calculatedCapacity.regularCount,
        calculated_halftime_count: calculatedCapacity.halftimeCount,
        regular_count: regularCount,
        halftime_count: halftimeCount,
        total_count: regularCount + halftimeCount,
      },
      current_selection: described.find((position) => position.status === 'mine') || null,
      positions: selectionState === 'cancelled' ? [] : described,
    };
  }

  async select(
    userId: number,
    registrationId: number,
    positionId: number,
    deviceInfo?: DeviceInfo,
  ) {
    const initial = await this.findOwnedRegistration(userId, registrationId);

    try {
      const selected = await this.positionRepo.manager.transaction(async (manager) => {
        const sessionRepo = manager.getRepository(Session);
        const registrationRepo = manager.getRepository(RoadshowRegistration);
        const positionRepo = manager.getRepository(RoadshowPosition);

        const session = await sessionRepo.findOne({
          where: { id: initial.session_id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!session) throw new HttpException('场次不存在', HttpStatus.NOT_FOUND);
        this.assertSelectionOpen(session);

        const registration = await registrationRepo.findOne({
          where: { id: registrationId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!registration || registration.user_id !== userId) {
          throw new HttpException('报名不存在', HttpStatus.NOT_FOUND);
        }
        if (registration.status !== RegistrationStatus.APPROVED) {
          throw new HttpException('只有已通过审核的路演报名可以选择位次', HttpStatus.CONFLICT);
        }

        const approvedCount = await registrationRepo.count({
          where: { session_id: session.id, status: RegistrationStatus.APPROVED },
        });
        const capacity = calculateRoadshowPositionCapacity(approvedCount);
        await this.ensurePositions(manager, session.id, capacity.regularCount, capacity.halftimeCount);

        const visiblePositionIds = new Set(this.visiblePositions(
          await positionRepo.find({ where: { session_id: session.id } }),
          capacity.regularCount,
          capacity.halftimeCount,
        ).map((item) => item.id));
        if (!visiblePositionIds.has(positionId)) {
          throw new HttpException('位次不存在或已不在当前可见范围，请刷新后重试', HttpStatus.NOT_FOUND);
        }

        const existing = await positionRepo.findOne({
          where: { registration_id: registration.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (existing) {
          if (existing.id === positionId) return existing;
          throw new HttpException('该报名已锁定位次，请先取消原位次后再选择', HttpStatus.CONFLICT);
        }

        const position = await positionRepo.findOne({
          where: { id: positionId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!position || position.session_id !== session.id) {
          throw new HttpException('位次不存在或不属于当前场次', HttpStatus.NOT_FOUND);
        }
        if (position.registration_id) {
          throw new HttpException('该位次刚刚被其他用户选择，请刷新后重试', HttpStatus.CONFLICT);
        }

        position.registration_id = registration.id;
        position.selected_by_user_id = userId;
        position.selected_at = new Date();
        position.admin_locked = false;
        const saved = await positionRepo.save(position);
        await manager.getRepository(RoadshowPositionEvent).save({
          session_id: session.id,
          registration_id: registration.id,
          position_id: saved.id,
          user_id: userId,
          action: RoadshowPositionEventAction.SELECT,
          device_info: deviceInfo ? serializeDeviceInfo(deviceInfo) : null,
        });
        await this.ensureTrailingAvailablePositions(
          manager,
          session.id,
          capacity.regularCount,
          capacity.halftimeCount,
        );
        return saved;
      });
      return { selected: true, position_id: selected.id };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new HttpException('位次已被占用或该报名已有位次，请刷新后重试', HttpStatus.CONFLICT);
      }
      throw error;
    }
  }

  async cancel(userId: number, registrationId: number, deviceInfo?: DeviceInfo) {
    const initial = await this.findOwnedRegistration(userId, registrationId);
    return this.positionRepo.manager.transaction(async (manager) => {
      const session = await manager.getRepository(Session).findOne({
        where: { id: initial.session_id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!session) throw new HttpException('场次不存在', HttpStatus.NOT_FOUND);
      // 与 select() 对齐校验选位通道；但场次已取消时放行撤回，允许用户释放位次。
      if (!session.is_cancelled) {
        this.assertSelectionOpen(session);
      }

      const registration = await manager.getRepository(RoadshowRegistration).findOne({
        where: { id: registrationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!registration || registration.user_id !== userId) {
        throw new HttpException('报名不存在', HttpStatus.NOT_FOUND);
      }

      const positionRepo = manager.getRepository(RoadshowPosition);
      const position = await positionRepo.findOne({
        where: { registration_id: registration.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!position) return { cancelled: false, position_id: null };

      // 管理员锁定的位次禁止用户自行撤回。
      if (position.admin_locked) {
        throw new HttpException('该位次已被管理员锁定', HttpStatus.CONFLICT);
      }
      const clearedAdminLocked = position.admin_locked;

      await manager.getRepository(RoadshowPositionEvent).save({
        session_id: session.id,
        registration_id: registration.id,
        position_id: position.id,
        user_id: userId,
        action: RoadshowPositionEventAction.CANCEL,
        device_info: deviceInfo ? serializeDeviceInfo(deviceInfo) : null,
        cleared_admin_locked: clearedAdminLocked,
      });
      const positionId = position.id;
      position.registration_id = null;
      position.selected_by_user_id = null;
      position.selected_at = null;
      position.admin_locked = false;
      await positionRepo.save(position);
      // 撤回选位后清除编排序号，避免陈旧 sort_order 残留（只写目标列）。
      await manager.getRepository(RoadshowRegistration).update(registration.id, { sort_order: null });
      return { cancelled: true, position_id: positionId };
    });
  }

  private async findOwnedRegistration(userId: number, registrationId: number) {
    if (!Number.isInteger(registrationId) || registrationId <= 0) {
      throw new HttpException('报名 ID 无效', HttpStatus.BAD_REQUEST);
    }
    const registration = await this.registrationRepo.findOne({
      where: { id: registrationId, user_id: userId },
      relations: ['session'],
    });
    if (!registration || !registration.session) {
      throw new HttpException('报名不存在', HttpStatus.NOT_FOUND);
    }
    return registration;
  }

  private async ensurePositions(
    manager: EntityManager,
    sessionId: number,
    regularTarget: number,
    halftimeTarget: number,
  ) {
    const repo = manager.getRepository(RoadshowPosition);
    const existing = await repo.find({
      where: { session_id: sessionId },
      order: { position_no: 'ASC' },
    });
    const maxRegular = this.maxPositionNo(existing, RoadshowPositionSection.REGULAR);
    const maxHalftime = this.maxPositionNo(existing, RoadshowPositionSection.HALFTIME);
    const additions: RoadshowPosition[] = [];

    for (let no = maxRegular + 1; no <= regularTarget; no += 1) {
      additions.push(repo.create({
        session_id: sessionId,
        section: RoadshowPositionSection.REGULAR,
        position_no: no,
        registration_id: null,
        selected_by_user_id: null,
        selected_at: null,
        admin_locked: false,
      }));
    }
    for (let no = maxHalftime + 1; no <= halftimeTarget; no += 1) {
      additions.push(repo.create({
        session_id: sessionId,
        section: RoadshowPositionSection.HALFTIME,
        position_no: no,
        registration_id: null,
        selected_by_user_id: null,
        selected_at: null,
        admin_locked: false,
      }));
    }
    if (additions.length > 0) await repo.save(additions);
  }

  private async ensureTrailingAvailablePositions(
    manager: EntityManager,
    sessionId: number,
    regularTarget: number,
    halftimeTarget: number,
  ) {
    const repo = manager.getRepository(RoadshowPosition);
    const positions = await repo.find({
      where: { session_id: sessionId },
      order: { position_no: 'ASC' },
    });
    const additions: RoadshowPosition[] = [];
    for (const section of [RoadshowPositionSection.REGULAR, RoadshowPositionSection.HALFTIME]) {
      const sectionPositions = positions.filter((position) => position.section === section);
      const baseTarget = section === RoadshowPositionSection.REGULAR ? regularTarget : halftimeTarget;
      const visibleLimit = this.visiblePositionLimit(sectionPositions, baseTarget);
      const existingNumbers = new Set(sectionPositions.map((position) => position.position_no));
      for (let no = 1; no <= visibleLimit; no += 1) {
        if (!existingNumbers.has(no)) {
          additions.push(repo.create({
            session_id: sessionId,
            section,
            position_no: no,
            registration_id: null,
            selected_by_user_id: null,
            selected_at: null,
            admin_locked: false,
          }));
        }
      }
    }
    if (additions.length > 0) await repo.save(additions);
  }

  private visiblePositions(
    positions: RoadshowPosition[],
    regularTarget: number,
    halftimeTarget: number,
  ) {
    const limits = {
      [RoadshowPositionSection.REGULAR]: this.visiblePositionLimit(
        positions.filter((position) => position.section === RoadshowPositionSection.REGULAR),
        regularTarget,
      ),
      [RoadshowPositionSection.HALFTIME]: this.visiblePositionLimit(
        positions.filter((position) => position.section === RoadshowPositionSection.HALFTIME),
        halftimeTarget,
      ),
    };
    return positions.filter((position) => position.position_no <= limits[position.section]);
  }

  private visiblePositionLimit(sectionPositions: RoadshowPosition[], baseTarget: number) {
    const highestOccupied = Math.max(
      0,
      ...sectionPositions
        .filter((position) => position.registration_id)
        .map((position) => position.position_no),
    );
    const coreLimit = Math.max(baseTarget, highestOccupied);
    const hasAvailableBeforeOrAtLimit = sectionPositions.some((position) =>
      position.position_no <= coreLimit && !position.registration_id,
    );
    return coreLimit + (hasAvailableBeforeOrAtLimit ? 0 : 1);
  }

  private describePosition(
    position: RoadshowPosition,
    registrationId: number,
    eventDate: string | Date,
    regularTimelineGroupCount: number,
    slotMinutes: number,
    halftimeDelayMinutes: number,
  ) {
    const isRegular = position.section === RoadshowPositionSection.REGULAR;
    const minuteOffset = isRegular
      ? (position.position_no - 1) * slotMinutes
      : regularTimelineGroupCount * slotMinutes + halftimeDelayMinutes + (position.position_no - 1) * slotMinutes;
    const referenceTime = addMinutes(eventDate, minuteOffset);
    return {
      id: position.id,
      section: position.section,
      position_no: position.position_no,
      label: isRegular ? `普通 ${position.position_no}` : `中场 ${position.position_no}`,
      reference_time: referenceTime?.toISOString() || null,
      reference_time_only: !isRegular,
      status: position.registration_id
        ? position.registration_id === registrationId ? 'mine' : 'occupied'
        : 'available',
      occupant: position.registration ? {
        group_name: position.registration.group_name,
        song_name: position.registration.song_name,
        artist_name: position.registration.artist_name,
      } : null,
      registration_id: position.registration_id === registrationId ? registrationId : null,
      selected_at: position.registration_id === registrationId ? position.selected_at : null,
    };
  }

  private getSelectionState(session: Session): SelectionState {
    if (session.is_cancelled) return 'cancelled';
    if (!session.roadshow_selection_enabled) return 'disabled';
    if (!session.roadshow_selection_open_at) return 'not_configured';
    return new Date() >= new Date(session.roadshow_selection_open_at) ? 'open' : 'not_open';
  }

  private assertSelectionOpen(session: Session) {
    const state = this.getSelectionState(session);
    if (state === 'open') return;
    const status = state === 'not_open' ? HttpStatus.FORBIDDEN : HttpStatus.CONFLICT;
    throw new HttpException(this.selectionStateMessage(state, session), status);
  }

  private selectionStateMessage(state: SelectionState, session: Session) {
    const messages: Record<SelectionState, string> = {
      disabled: '该场次暂未开启路演选位通道',
      not_configured: '该场次尚未配置选位开放时间',
      not_open: `选位通道将在 ${new Date(session.roadshow_selection_open_at as Date).toLocaleString('zh-CN')} 开放`,
      open: '选位通道已开放',
      cancelled: '该场次已取消',
    };
    return messages[state];
  }

  private maxPositionNo(positions: RoadshowPosition[], section: RoadshowPositionSection) {
    return Math.max(0, ...positions.filter((position) => position.section === section).map((position) => position.position_no));
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

  private registrationStatusName(status: RegistrationStatus) {
    return ['pending', 'approved', 'rejected'][status] || 'pending';
  }
}
