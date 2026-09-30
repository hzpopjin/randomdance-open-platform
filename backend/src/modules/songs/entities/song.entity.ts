import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('songs')
export class Song {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 256 }) song_name: string;
  @Column({ length: 128 }) artist_name: string;
  @Column({ length: 256, nullable: true }) alt_title: string;
  @Column({ type: 'text', nullable: true }) remark: string;
  @Column({ type: 'tinyint', default: 0 }) status: number;
  @Column({ nullable: true }) user_id: number;
  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}
