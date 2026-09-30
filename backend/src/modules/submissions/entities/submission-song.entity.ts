import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Submission } from './submission.entity';

@Entity('submission_songs')
export class SubmissionSong {
  @PrimaryGeneratedColumn() id: number;
  @Column() submission_id: number;
  @Column({ nullable: true }) song_id: number;
  @Column({ length: 256 }) song_name: string;
  @Column({ length: 128 }) artist_name: string;
  @Column({ length: 256, nullable: true }) alt_title: string;
  @Column({ length: 512, nullable: true }) full_title: string;
  @Column({ length: 16, nullable: true }) file_extension: string;
  @Column({ length: 512, nullable: true }) full_file_path: string;
  @Column({ length: 512, nullable: true }) chorus_file_path: string;
  @Column({ length: 1024, nullable: true }) reference_url: string;
  @Column({ type: 'tinyint', default: 1 }) play_part: number;
  @Column({ length: 256, nullable: true }) custom_part_desc: string;
  @Column({ type: 'int', default: 0 }) sort_order: number;
  @ManyToOne(() => Submission, (s) => s.songs) @JoinColumn({ name: 'submission_id' }) submission: Submission;
}
