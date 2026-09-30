import { Controller, Get, Param, Query } from '@nestjs/common';
import { SessionService } from './session.service';

@Controller('sessions')
export class SessionController {
  constructor(private sessionService: SessionService) {}

  @Get()
  findAll(@Query('organizer_id') organizerId?: string) {
    // 非法值忽略：仅当为有限数字时才作为主办方过滤条件透传。
    const parsed = organizerId !== undefined && organizerId !== '' ? Number(organizerId) : NaN;
    return this.sessionService.findAllPublic(Number.isFinite(parsed) ? parsed : undefined);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sessionService.findOne(+id);
  }
}
