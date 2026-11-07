import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service.js';
import { jwt as jwtUtil, type JwtPayload } from '../../common/utils/jwt.js';
import type { AppConfig } from '../../config/app-config.js';
import { Prisma } from '../../generated/prisma/client.js';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService, @Inject('APP_CONFIG') private readonly config: AppConfig) {}

  async register(username: string, password: string) {
    const existing = await this.usersService.findByUsername(username);
    if (existing) {
      throw new ConflictException('Username already taken');
    }
    const passwordHash = await bcrypt.hash(password, this.config.bcryptRounds);
    try {
      const user = await this.usersService.create(username, passwordHash);
      return { id: user.id, username: user.username, role: user.role };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Username already taken');
      }
      throw error;
    }
  }

  async login(username: string, password: string): Promise<{ accessToken: string }> {
    const user = await this.usersService.findByUsername(username);
    // Always run compare to prevent timing attacks revealing username existence
    const dummyHash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
    const hash = user?.passwordHash ?? dummyHash;
    const valid = await bcrypt.compare(password, hash);
    if (!user || !valid || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload: JwtPayload = { sub: user.id, role: user.role };
    const accessToken = jwtUtil.sign(payload, this.config.jwtSecret, this.config.jwtExpiresInSeconds, this.config.jwtIssuer, this.config.jwtAudience);
    return { accessToken };
  }

  async getMe(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      loyaltyBalance: user.loyaltyBalance,
    };
  }
}
