import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('client_config')
export class ClientConfig {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 64, unique: true }) config_key: string;
  @Column({ type: 'json' }) config_value: any;
  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}
