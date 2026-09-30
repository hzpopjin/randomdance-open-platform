import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Song } from './entities/song.entity';
import { SongService } from './song.service';

@Module({
  imports: [TypeOrmModule.forFeature([Song])],
  providers: [SongService],
  exports: [SongService],
})
export class SongModule {}
