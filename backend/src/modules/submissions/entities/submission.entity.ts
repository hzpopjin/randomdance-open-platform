import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Session } from '../../sessions/entities/session.entity';
import { SubmissionSong } from './submission-song.entity';

export enum SubmissionStatus { PENDING = 'pending', APPROVED = 'approved', REJECTED = 'rejected' }

@Entity('submissions')
@Index('UQ_submissions_form_fingerprint', ['user_id', 'session_id', 'form_fingerprint'], { unique: true })
@Index('IDX_submissions_session_status', ['session_id', 'status'])
export class Submission {
  @PrimaryGeneratedColumn() id: number;
  @Column() user_id: number;
  @Column() session_id: number;
  @Column({ type: 'varchar', length: 20, default: SubmissionStatus.PENDING }) status: SubmissionStatus;
  @Column({ length: 512, nullable: true }) review_comment: string;
  @Column({ type: 'text', nullable: true }) device_info: string | null;
  @Column({ type: 'varchar', length: 64, nullable: true, select: false }) form_fingerprint: string | null;
  @ManyToOne(() => User) @JoinColumn({ name: 'user_id' }) user: User;
  @ManyToOne(() => Session, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'session_id' }) session: Session;
  @OneToMany(() => SubmissionSong, (s) => s.submission, { cascade: true }) songs: SubmissionSong[];
  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}
