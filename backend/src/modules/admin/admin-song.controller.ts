import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { SongService } from '../songs/song.service';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/songs')
export class AdminSongController {
  constructor(private songService: SongService) {}

  @Get()
  findAll(@Query() query: any) { return this.songService.findAll(query); }

  @Get('pending')
  findPending(@Query() query: any) { return this.songService.findPending(query); }

  @Post()
  create(@Body() body: any) { return this.songService.create(body); }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.songService.update(+id, body); }

  @Put(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: number }) {
    return this.songService.updateStatus(+id, body.status);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.songService.remove(+id); }
}
