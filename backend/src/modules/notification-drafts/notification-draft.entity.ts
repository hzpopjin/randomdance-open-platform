import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
export interface DraftVariable { name: string; required: boolean }
@Entity('notification_drafts')
@Index('uq_notification_drafts_owner_name', ['organizer_id', 'name'], { unique: true })
export class NotificationDraft {
  @PrimaryGeneratedColumn() id: number;
  @Column() organizer_id: number;
  @Column({ length: 80 }) name: string;
  @Column({ length: 120 }) title: string;
  @Column({ type: 'text' }) body: string;
  @Column({ type: 'json' }) variables: DraftVariable[];
  @Column({ type: 'enum', enum: ['draft', 'archived'], default: 'draft' }) status: 'draft' | 'archived';
  @Column({ type: 'int', unsigned: true, default: 1 }) revision: number;
  @Column() created_by: number;
  @Column() updated_by: number;
  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}
