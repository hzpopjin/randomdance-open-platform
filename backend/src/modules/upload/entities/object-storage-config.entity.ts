import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('object_storage_config')
export class ObjectStorageConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'boolean', default: false })
  enabled: boolean;

  @Column({ type: 'varchar', length: 32, default: 'volcengine_tos' })
  provider: string;

  @Column({ type: 'varchar', length: 128, default: '' })
  access_key_id: string;

  @Column({ type: 'text', nullable: true })
  access_key_secret_ciphertext: string | null;

  @Column({ type: 'varchar', length: 64, default: 'cn-beijing' })
  region: string;

  @Column({ type: 'varchar', length: 255, default: 'tos-cn-beijing.volces.com' })
  endpoint: string;

  @Column({ type: 'varchar', length: 63, default: '' })
  bucket: string;

  @Column({ type: 'varchar', length: 512, default: '' })
  public_base_url: string;

  @Column({ type: 'varchar', length: 255, default: 'chaojifather' })
  key_prefix: string;

  @Column({
    type: 'varchar',
    length: 255,
    default: '{registrationNumber}_{songName}_{groupName}',
  })
  roadshow_media_name_template: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
