import { Controller, Post, Body } from '@nestjs/common';
import { ClientEventsService } from './client-events.service';

@Controller('client-events')
export class ClientEventsController {
  constructor(private service: ClientEventsService) {}

  @Post()
  create(@Body() body: any) {
    return this.service.create(body);
  }
}
