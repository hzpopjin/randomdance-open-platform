import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('client_events')
export class ClientEvent {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id: number;
  @Column({ length: 64 }) event_id: string;
  @Column({ length: 128 }) event_type: string;
  @Column({ length: 64, nullable: true }) platform: string;
  @Column({ length: 128, nullable: true }) device_id: string;
  @Column({ length: 128, nullable: true }) request_id: string;
  @Column({ length: 64, nullable: true }) uid: string;
  @Column({ length: 64, nullable: true }) auth_user_id: string;
  @Column({ length: 64, nullable: true }) ip: string;
  @Column({ length: 512, nullable: true }) user_agent: string;
  @Column({ length: 64, nullable: true }) resource_type: string;
  @Column({ length: 128, nullable: true }) resource_id: string;
  @Column({ type: 'json', nullable: true }) context_payload: any;
  @Column({ length: 64, nullable: true }) app_version: string;
  @Column({ length: 128, nullable: true }) device_model: string;
  @Column({ length: 128, nullable: true }) os_version: string;
  @Column({ type: 'datetime' }) occurred_at: Date;
  @CreateDateColumn() received_at: Date;
}
