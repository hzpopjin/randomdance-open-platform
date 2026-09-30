import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('sessions')
@Index('IDX_sessions_event_date', ['event_date'])
@Index('IDX_sessions_visibility_event_date', ['is_cancelled', 'event_date'])
@Index('IDX_sessions_organizer_event_date', ['organizer_id', 'event_date'])
export class Session {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 128 }) name: string;
  @Column({ type: 'datetime' }) event_date: string;
  @Column({ length: 256 }) location: string;
  @Column({ type: 'datetime', nullable: true }) registration_start: Date;
  @Column({ type: 'datetime', nullable: true }) registration_end: Date;
  @Column({ type: 'text', nullable: true }) venue_info: string;
  @Column({ type: 'boolean', default: false }) roadshow_selection_enabled: boolean;
  @Column({ type: 'datetime', nullable: true, default: null }) roadshow_selection_open_at: Date | null;
  @Column({ type: 'int', default: 5 }) roadshow_slot_minutes: number;
  @Column({ type: 'int', default: 60 }) roadshow_halftime_delay_minutes: number;
  @Column({ type: 'boolean', default: false }) is_cancelled: boolean;
  @Column({ type: 'datetime', nullable: true }) cancelled_at: Date | null;
  @Column({ type: 'int', nullable: true }) organizer_id: number | null;
  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}
