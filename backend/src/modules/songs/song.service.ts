import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Song } from './entities/song.entity';

@Injectable()
export class SongService {
  constructor(@InjectRepository(Song) private songRepo: Repository<Song>) {}

  async findAll(params: { page?: number; page_size?: number; keyword?: string; status?: string }) {
    const page = Number(params.page || 1);
    const pageSize = Number(params.page_size || 10);
    const qb = this.songRepo.createQueryBuilder('s');
    if (params.keyword) {
      qb.andWhere('(s.song_name LIKE :kw OR s.artist_name LIKE :kw OR s.alt_title LIKE :kw)', { kw: `%${params.keyword}%` });
    }
    if (params.status !== undefined && params.status !== '') {
      qb.andWhere('s.status = :status', { status: Number(params.status) });
    }
    const [list, total] = await qb.orderBy('s.created_at', 'DESC')
      .skip((page - 1) * pageSize).take(pageSize).getManyAndCount();
    return { list, total, page, page_size: pageSize };
  }

  async findPending(params: { page?: number; page_size?: number }) {
    const page = Number(params.page || 1);
    const pageSize = Number(params.page_size || 10);
    const [list, total] = await this.songRepo.findAndCount({
      where: { status: 0 }, order: { created_at: 'DESC' },
      skip: (page - 1) * pageSize, take: pageSize,
    });
    return { list, total, page, page_size: pageSize };
  }

  async create(data: Partial<Song>) {
    const song = this.songRepo.create(data);
    return this.songRepo.save(song);
  }

  async update(id: number, data: Partial<Song>) {
    const song = await this.songRepo.findOne({ where: { id } });
    if (!song) throw new HttpException('歌曲不存在', HttpStatus.NOT_FOUND);
    Object.assign(song, data);
    return this.songRepo.save(song);
  }

  async updateStatus(id: number, status: number) {
    await this.songRepo.update(id, { status });
    return { id, status };
  }

  async remove(id: number) {
    const song = await this.songRepo.findOne({ where: { id } });
    if (!song) throw new HttpException('歌曲不存在', HttpStatus.NOT_FOUND);
    await this.songRepo.remove(song);
    return { id };
  }
}
