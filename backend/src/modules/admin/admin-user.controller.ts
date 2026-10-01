import { Controller, Get, Post, Put, Param, Query, Body, UseGuards, HttpException, HttpStatus, ConflictException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, User } from '../users/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { hash } from 'bcryptjs';
import { PaginationDto } from '../../common/dto/pagination.dto';

/** 合法角色白名单：0=普通用户 / 1=超级管理员 / 2=主办方。 */
const VALID_ROLES = [UserRole.USER, UserRole.ADMIN, UserRole.ORGANIZER];

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/users')
export class AdminUserController {
  constructor(@InjectRepository(User) private userRepo: Repository<User>) {}

  private serialize(u: User) {
    return {
      id: u.id, username: u.username, nickname: u.nickname, phone: u.phone,
      email: u.email, role: u.role, avatar_url: u.avatar_url,
      status: u.status, organizer_name: u.organizer_name ?? null,
      created_at: u.created_at, updated_at: u.updated_at,
    };
  }

  private assertNotSelf(id: number, currentUserId: number) {
    if (id === currentUserId) {
      throw new HttpException('不能修改自己的角色或状态', HttpStatus.BAD_REQUEST);
    }
  }

  @Get()
  async findAll(
    @Query() query: PaginationDto,
    @Query('keyword') keyword?: string,
    @Query('role') role?: string,
  ) {
    // 用 PaginationDto 接分页（有 metatype 才会过全局 ValidationPipe 转换/校验，
    // 杜绝 ?page_size=abc 使 LIMIT 收到 NaN 而报 500）；过滤参数用独立 @Query 接收。
    const { page = 1, page_size = 10 } = query;
    const qb = this.userRepo.createQueryBuilder('u');
    if (keyword) {
      qb.andWhere('(u.username LIKE :kw OR u.nickname LIKE :kw OR u.phone LIKE :kw OR u.email LIKE :kw)', { kw: `%${keyword}%` });
    }
    // 保持「非空字符串即生效」判定，确保 ?role=0（普通用户）仍然能被过滤。
    if (role !== undefined && role !== null && String(role) !== '') {
      qb.andWhere('u.role = :role', { role: Number(role) });
    }
    const [list, total] = await qb.orderBy('u.created_at', 'DESC')
      .skip((page - 1) * page_size).take(page_size).getManyAndCount();
    return {
      list: list.map((u) => this.serialize(u)), total, page, page_size,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const user = await this.userRepo.findOne({ where: { id: +id } });
    if (!user) throw new HttpException('用户不存在', HttpStatus.NOT_FOUND);
    return this.serialize(user);
  }

  @Post()
  async create(@Body() body: {
    username?: string; password?: string; nickname?: string;
    phone?: string; email?: string; role?: number; organizer_name?: string;
  }) {
    const username = body.username?.trim();
    if (!username || !body.password) {
      throw new HttpException('用户名和密码必填', HttpStatus.BAD_REQUEST);
    }
    const role = body.role === undefined ? UserRole.USER : Number(body.role);
    if (!VALID_ROLES.includes(role)) {
      throw new HttpException('角色值无效', HttpStatus.BAD_REQUEST);
    }
    const organizerName = body.organizer_name?.trim() || null;
    if (role === UserRole.ORGANIZER && !organizerName) {
      throw new HttpException('主办方必须填写对外展示名称', HttpStatus.BAD_REQUEST);
    }
    const existing = await this.userRepo.findOne({ where: { username } });
    if (existing) throw new ConflictException('用户名已被使用');

    const user = this.userRepo.create({
      username,
      password: await hash(body.password, 10),
      nickname: body.nickname || username,
      phone: body.phone || null,
      email: body.email || null,
      role: role as UserRole,
      organizer_name: organizerName,
      status: 1,
    });
    try {
      await this.userRepo.save(user);
    } catch (error) {
      // check-then-insert 竞态：并发下第二个请求撞 username 唯一索引 → 409（文案与前置校验逐字一致）。
      if (error instanceof QueryFailedError) throw new ConflictException('用户名已被使用');
      throw error;
    }
    return this.serialize(user);
  }

  @Put(':id')
  async update(
    @CurrentUser('id') currentUserId: number,
    @Param('id') id: string,
    @Body() body: { nickname?: string; phone?: string; email?: string; organizer_name?: string },
  ) {
    const userId = +id;
    this.assertNotSelf(userId, currentUserId);
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new HttpException('用户不存在', HttpStatus.NOT_FOUND);

    // 显式白名单编辑，杜绝越权写入 role/status/password。
    if (body.nickname !== undefined) user.nickname = body.nickname;
    if (body.phone !== undefined) user.phone = body.phone;
    if (body.email !== undefined) user.email = body.email;
    if (body.organizer_name !== undefined) {
      user.organizer_name = body.organizer_name?.trim() || null;
    }
    // 与创建、角色变更入口保持同一不变量：主办方账号始终必须有对外展示名。
    // 前端表单虽已设为必填，但 API 仍需独立防御空字符串/null 绕过。
    if (user.role === UserRole.ORGANIZER && !user.organizer_name) {
      throw new HttpException('主办方必须填写对外展示名称', HttpStatus.BAD_REQUEST);
    }
    await this.userRepo.save(user);
    return this.serialize(user);
  }

  @Put(':id/role')
  async updateRole(
    @CurrentUser('id') currentUserId: number,
    @Param('id') id: string,
    @Body() body: { role: number; organizer_name?: string },
  ) {
    const userId = +id;
    this.assertNotSelf(userId, currentUserId);
    const role = Number(body.role);
    if (!VALID_ROLES.includes(role)) {
      throw new HttpException('角色值无效', HttpStatus.BAD_REQUEST);
    }
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new HttpException('用户不存在', HttpStatus.NOT_FOUND);
    if (user.is_guest && role !== UserRole.USER) {
      throw new HttpException('游客账号不能直接赋予管理角色', HttpStatus.BAD_REQUEST);
    }

    if (body.organizer_name !== undefined) {
      user.organizer_name = body.organizer_name?.trim() || null;
    }
    // 升为主办方时必须具备对外展示名称（已有或本次提供）。
    if (role === UserRole.ORGANIZER && !user.organizer_name) {
      throw new HttpException('主办方必须填写对外展示名称', HttpStatus.BAD_REQUEST);
    }
    user.role = role as UserRole;
    await this.userRepo.save(user);
    return { id: user.id, role: user.role, organizer_name: user.organizer_name ?? null };
  }

  @Put(':id/status')
  async updateStatus(
    @CurrentUser('id') currentUserId: number,
    @Param('id') id: string,
    @Body() body: { status: number },
  ) {
    const userId = +id;
    this.assertNotSelf(userId, currentUserId);
    const status = Number(body.status);
    if (status !== 0 && status !== 1) {
      throw new HttpException('状态值无效', HttpStatus.BAD_REQUEST);
    }
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new HttpException('用户不存在', HttpStatus.NOT_FOUND);
    user.status = status;
    await this.userRepo.save(user);
    return { id: user.id, status: user.status };
  }
}
