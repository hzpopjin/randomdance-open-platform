import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum UserRole {
  USER = 0,
  ADMIN = 1,
  ORGANIZER = 2,
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 64, unique: true })
  username: string;

  @Column({ length: 128 })
  password: string;

  @Column({ length: 64, nullable: true })
  nickname: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ length: 128, nullable: true })
  email: string;

  @Column({ length: 512, nullable: true })
  avatar_url: string;

  @Column({ type: 'tinyint', default: UserRole.USER })
  role: UserRole;

  @Column({ type: 'tinyint', default: 1 })
  status: number;

  @Column({ type: 'tinyint', default: 0 })
  is_guest: number;

  @Column({ length: 128, nullable: true })
  organizer_name: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
