import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service.js';
import { jwt as jwtUtil, type JwtPayload } from '../../common/utils/jwt.js';

const BCRYPT_ROUNDS = 10;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return secret;
}

function getJwtExpiresIn(): number {
  const raw = process.env.JWT_EXPIRES_IN ?? '900'; // default 15 min
  // accept "15m", "3600", "1h" formats
  if (/^\d+m$/.test(raw)) return parseInt(raw) * 60;
  if (/^\d+h$/.test(raw)) return parseInt(raw) * 3600;
  return parseInt(raw) || 900;
}

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  async register(username: string, password: string) {
    const existing = await this.usersService.findByUsername(username);
    if (existing) {
      throw new ConflictException('Username already taken');
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await this.usersService.create(username, passwordHash);
    return {
      id: user.id,
      username: user.username,
      role: user.role,
    };
  }

  async login(username: string, password: string): Promise<{ accessToken: string }> {
    const user = await this.usersService.findByUsername(username);
    // Always run compare to prevent timing attacks revealing username existence
    const dummyHash = '$2b$10$dummyhash.used.to.prevent.timing.attacks.padded';
    const hash = user?.passwordHash ?? dummyHash;
    const valid = await bcrypt.compare(password, hash);
    if (!user || !valid || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload: JwtPayload = { sub: user.id, role: user.role };
    const accessToken = jwtUtil.sign(payload, getJwtSecret(), getJwtExpiresIn());
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
