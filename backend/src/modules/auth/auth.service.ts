import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { compare, hash } from 'bcryptjs';
import { randomBytes, randomUUID } from 'crypto';
import { User, UserRole } from '../users/entities/user.entity';
import { RegisterDto, LoginDto, UpdateProfileDto } from './dto/auth.dto';
import { JWT_IDENTITY_VERSION } from './auth.constants';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.userRepo.findOne({ where: { username: dto.username } });
    if (existing) {
      throw new ConflictException('用户名已被使用');
    }

    const hashedPassword = await this.hashPassword(dto.password);
    const user = this.userRepo.create({
      username: dto.username,
      password: hashedPassword,
      nickname: dto.nickname || dto.username,
      phone: dto.phone || null,
      email: dto.email || null,
      role: UserRole.USER,
    });
    await this.userRepo.save(user);
    return this.generateToken(user);
  }

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({ where: { username: dto.username } });
    if (!user || !user.password || user.is_guest) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const passwordMatched = await this.verifyPassword(dto.password, user.password);
    if (!passwordMatched) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    if (user.status === 0) {
      throw new UnauthorizedException('账号已停用，请联系管理员');
    }

    return this.generateToken(user);
  }

  async getProfile(userId: number) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('用户不存在');
    return this.serializeUser(user, true);
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('用户不存在');

    if (dto.nickname !== undefined) user.nickname = dto.nickname;
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.email !== undefined) user.email = dto.email;
    if (dto.password) {
      if (user.is_guest) throw new UnauthorizedException('游客账号不能设置登录密码');
      user.password = await this.hashPassword(dto.password);
    }

    await this.userRepo.save(user);
    return this.getProfile(userId);
  }

  private generateToken(user: User) {
    const payload = {
      sub: user.id,
      role: user.role,
      identityVersion: JWT_IDENTITY_VERSION,
    };
    return {
      token: this.jwtService.sign(payload),
      user: this.serializeUser(user),
    };
  }

  serializeUser(user: User, includeTimestamps = false) {
    return {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      phone: user.phone,
      email: user.email,
      role: user.role,
      avatar_url: user.avatar_url,
      status: user.status,
      organizer_name: user.organizer_name ?? null,
      ...(includeTimestamps
        ? { created_at: user.created_at, updated_at: user.updated_at }
        : {}),
    };
  }

  private async hashPassword(password: string) {
    return hash(password, 10);
  }

  async guestLogin(body?: { device_id?: string; guest_id?: number; guest_secret?: string }) {
    const hasId = body?.guest_id !== undefined;
    const hasSecret = body?.guest_secret !== undefined;
    if (hasId !== hasSecret) throw new UnauthorizedException('游客凭证不完整');

    if (hasId) {
      const id = body!.guest_id;
      const secret = body!.guest_secret;
      if (!Number.isSafeInteger(id) || id! <= 0 || typeof secret !== 'string' ||
          !/^[a-f0-9]{64}$/.test(secret)) {
        throw new UnauthorizedException('游客凭证无效');
      }
      const user = await this.userRepo.findOne({ where: { id } });
      if (!user || !user.is_guest || user.role !== UserRole.USER ||
          !(await this.verifyPassword(secret, user.password))) {
        throw new UnauthorizedException('游客凭证无效');
      }
      if (user.status === 0) throw new UnauthorizedException('账号已停用，请联系管理员');
      return { ...this.generateToken(user), guest_id: user.id, guest_secret: secret };
    }

    // device_id is intentionally never used to look up an account. Legacy
    // clients can still enter as a new guest, without recovering old data.
    const secret = randomBytes(32).toString('hex');
    const user = this.userRepo.create({
      username: `guest_${randomUUID()}`,
      password: await this.hashPassword(secret),
      nickname: `游客${randomBytes(3).toString('hex')}`,
      role: UserRole.USER,
      is_guest: 1,
    });
    await this.userRepo.save(user);
    return { ...this.generateToken(user), guest_id: user.id, guest_secret: secret };
  }

  private async verifyPassword(plainPassword: string, storedPassword: string) {
    return compare(plainPassword, storedPassword);
  }
}
