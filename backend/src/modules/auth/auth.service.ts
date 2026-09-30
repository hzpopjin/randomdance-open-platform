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
    if (!user || !user.password) {
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
    if (dto.password) user.password = await this.hashPassword(dto.password);

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

  async guestLogin(deviceId?: string) {
    if (deviceId) {
      const existing = await this.userRepo.findOne({ where: { username: deviceId } });
      if (existing) {
        if (existing.status === 0) {
          throw new UnauthorizedException('账号已停用，请联系管理员');
        }
        return this.generateToken(existing);
      }
    }

    const guestUsername = `guest_${deviceId || Date.now().toString(36)}`;
    let user = await this.userRepo.findOne({ where: { username: guestUsername } });
    if (!user) {
      user = this.userRepo.create({
        username: guestUsername,
        password: await this.hashPassword(Math.random().toString(36).slice(2)),
        nickname: `游客${Date.now().toString(36).slice(-6)}`,
        role: UserRole.USER,
      });
      await this.userRepo.save(user);
    }
    if (user.status === 0) {
      throw new UnauthorizedException('账号已停用，请联系管理员');
    }
    return this.generateToken(user);
  }

  private async verifyPassword(plainPassword: string, storedPassword: string) {
    return compare(plainPassword, storedPassword);
  }
}

