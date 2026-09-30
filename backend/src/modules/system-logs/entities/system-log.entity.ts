import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('system_logs')
export class SystemLog {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id: number;
  @Column({ length: 16 }) level: string;
  @Column({ length: 32 }) type: string;
  @Column({ length: 16, nullable: true }) method: string;
  @Column({ length: 512, nullable: true }) path: string;
  @Column({ type: 'int', nullable: true }) status_code: number;
  @Column({ type: 'int', nullable: true }) business_code: number;
  @Column({ length: 512, nullable: true }) message: string;
  @Column({ type: 'int', nullable: true }) duration_ms: number;
  @Column({ length: 64, nullable: true }) ip: string;
  @Column({ length: 512, nullable: true }) user_agent: string;
  @Column({ length: 64, nullable: true }) user_id: string;
  @Column({ length: 128, nullable: true }) request_id: string;
  @Column({ type: 'json', nullable: true }) query_payload: any;
  @Column({ type: 'json', nullable: true }) request_payload: any;
  @Column({ type: 'json', nullable: true }) response_payload: any;
  @Column({ type: 'text', nullable: true }) error_stack: string;
  @CreateDateColumn() created_at: Date;
}
