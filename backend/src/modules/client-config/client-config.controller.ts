import { Controller, Get, Param } from '@nestjs/common';
import { ClientConfigService } from './client-config.service';

@Controller('client-config')
export class ClientConfigController {
  constructor(private service: ClientConfigService) {}

  @Get(':key')
  get(@Param('key') key: string) {
    return this.service.get(key);
  }
}
