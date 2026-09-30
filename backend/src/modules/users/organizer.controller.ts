import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';

/**
 * 公共主办方列表（无需鉴权）。
 * 规则：status = 1 AND organizer_name IS NOT NULL AND role IN (1,2)，按 id ASC。
 * 响应经全局拦截器包装为 { code, message, data }，data = { list, total }。
 */
@Controller('organizers')
export class OrganizerController {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  @Get()
  async list() {
    const rows = await this.userRepo.find({
      where: {
        status: 1,
        organizer_name: Not(IsNull()),
        role: In([UserRole.ADMIN, UserRole.ORGANIZER]),
      },
      order: { id: 'ASC' },
    });
    return {
      list: rows.map((u) => ({ id: u.id, name: u.organizer_name })),
      total: rows.length,
    };
  }
}
