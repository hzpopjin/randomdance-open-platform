import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { RoadshowRegistration } from './roadshow-registration.entity';

@Entity('registration_members')
export class RegistrationMember {
  @PrimaryGeneratedColumn() id: number;
  @Column() registration_id: number;
  @Column({ length: 64 }) member_name: string;
  @Column({ length: 64, nullable: true }) position: string;
  @Column({ type: 'int', default: 0 }) sort_order: number;
  @ManyToOne(() => RoadshowRegistration, (r) => r.members) @JoinColumn({ name: 'registration_id' }) registration: RoadshowRegistration;
  @CreateDateColumn() created_at: Date;
}
