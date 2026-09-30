import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Session } from '../../sessions/entities/session.entity';
import { RoadshowRegistration } from './roadshow-registration.entity';

export enum RoadshowPositionSection {
  REGULAR = 'regular',
  HALFTIME = 'halftime',
}

@Entity('roadshow_positions')
@Index('UQ_roadshow_positions_session_section_no', ['session_id', 'section', 'position_no'], { unique: true })
@Index('UQ_roadshow_positions_registration', ['registration_id'], { unique: true })
@Index('IDX_roadshow_positions_session_section', ['session_id', 'section'])
export class RoadshowPosition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  session_id: number;

  @Column({ type: 'varchar', length: 16 })
  section: RoadshowPositionSection;

  @Column({ type: 'int' })
  position_no: number;

  @Column({ type: 'int', nullable: true, default: null })
  registration_id: number | null;

  @Column({ type: 'int', nullable: true, default: null })
  selected_by_user_id: number | null;

  @Column({ type: 'datetime', nullable: true, default: null })
  selected_at: Date | null;

  @Column({ type: 'boolean', default: false })
  admin_locked: boolean;

  @ManyToOne(() => Session, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: Session;

  @OneToOne(() => RoadshowRegistration, (registration) => registration.position, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'registration_id' })
  registration: RoadshowRegistration | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
