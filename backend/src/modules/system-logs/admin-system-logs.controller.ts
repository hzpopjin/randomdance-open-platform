import { Controller, Get, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { SystemLogService } from './system-log.service';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/system-logs')
export class AdminSystemLogsController {
  constructor(private logService: SystemLogService) {}

  @Get()
  findAll(@Query() query: any) {
    return this.logService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.logService.findOne(+id);
  }

  @Delete('batch')
  batchRemove(@Body() body: { ids: number[] }) {
    return this.logService.batchRemove(body.ids);
  }

  @Delete('clear')
  clearAll() {
    return this.logService.clearAll();
  }

  @Delete('clear-filtered')
  clearByFilter(@Body() body: { level?: string; type?: string }) {
    return this.logService.clearByFilter(body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.logService.remove(+id);
  }
}
