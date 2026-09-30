import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { ClientConfigService } from './client-config.service';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/client-config')
export class AdminClientConfigController {
  constructor(private service: ClientConfigService) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Put()
  set(@Body() body: { config_key: string; config_value: any }) {
    return this.service.set(body.config_key, body.config_value);
  }
}
