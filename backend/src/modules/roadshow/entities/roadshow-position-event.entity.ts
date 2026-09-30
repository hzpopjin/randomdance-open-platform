import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum RoadshowPositionEventAction {
  SELECT = 'select',
  CANCEL = 'cancel',
  ADMIN_ASSIGN = 'admin_assign',
  ADMIN_CANCEL = 'admin_cancel',
}

@Entity('roadshow_position_events')
@Index('IDX_roadshow_position_events_registration_created', ['registration_id', 'created_at'])
@Index('IDX_roadshow_position_events_session_created', ['session_id', 'created_at'])
export class RoadshowPositionEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  session_id: number;

  @Column()
  registration_id: number;

  @Column()
  position_id: number;

  @Column()
  user_id: number;

  @Column({ type: 'varchar', length: 16 })
  action: RoadshowPositionEventAction;

  @Column({ type: 'text', nullable: true })
  device_info: string | null;

  /** 本次事件清除的 admin_locked 原值（仅 cancel 等释放动作记录，其余为 null） */
  @Column({ type: 'boolean', nullable: true, default: null })
  cleared_admin_locked: boolean | null;

  @CreateDateColumn()
  created_at: Date;
}
