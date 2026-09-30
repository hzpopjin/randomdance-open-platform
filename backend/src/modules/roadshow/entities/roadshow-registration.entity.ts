import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany, OneToOne, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Session } from '../../sessions/entities/session.entity';
import { RegistrationMember } from './registration-member.entity';
import { RoadshowPosition } from './roadshow-position.entity';

export enum RegistrationStatus { PENDING = 0, APPROVED = 1, REJECTED = 2 }

@Entity('roadshow_registrations')
@Index('UQ_roadshow_registrations_form_fingerprint', ['user_id', 'session_id', 'form_fingerprint'], { unique: true })
@Index('IDX_roadshow_registrations_session_status', ['session_id', 'status'])
@Index('IDX_roadshow_registrations_session_sort_order', ['session_id', 'sort_order'])
export class RoadshowRegistration {
  @PrimaryGeneratedColumn() id: number;
  @Column() user_id: number;
  @Column() session_id: number;
  @Column({ length: 256 }) song_name: string;
  @Column({ length: 128 }) artist_name: string;
  @Column({ length: 128 }) group_name: string;
  @Column({ type: 'tinyint' }) song_format: number;
  @Column({ type: 'tinyint', default: 0 }) song_format_manually_set: number;
  @Column({ length: 512, nullable: true }) edited_file_url: string;
  @Column({ type: 'tinyint', default: 0 }) audio_enabled: number;
  @Column({ length: 20 }) contact_phone: string;
  @Column({ type: 'tinyint', default: 0 }) has_other_performance: number;
  @Column({ length: 512, nullable: true }) other_performance_detail: string;
  @Column({ type: 'text', nullable: true }) additional_requirements: string;
  @Column({ type: 'tinyint', default: RegistrationStatus.PENDING }) status: RegistrationStatus;
  @Column({ length: 512, nullable: true }) review_comment: string;
  @Column({ type: 'int', nullable: true, default: null }) sort_order: number | null;
  @Column({ type: 'tinyint', default: 0 }) review_video_submitted: number;
  @Column({ type: 'varchar', length: 512, nullable: true }) review_video_url: string | null;
  @Column({ type: 'tinyint', default: 0 }) review_video_enabled: number;
  @Column({ type: 'tinyint', default: 0 }) halftime_after: number;
  @Column({ type: 'text', nullable: true }) device_info: string | null;
  @Column({ type: 'varchar', length: 64, nullable: true, select: false }) form_fingerprint: string | null;
  @ManyToOne(() => User) @JoinColumn({ name: 'user_id' }) user: User;
  @ManyToOne(() => Session, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'session_id' }) session: Session;
  @OneToMany(() => RegistrationMember, (m) => m.registration, { cascade: true }) members: RegistrationMember[];
  @OneToOne(() => RoadshowPosition, (position) => position.registration) position: RoadshowPosition | null;
  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}
