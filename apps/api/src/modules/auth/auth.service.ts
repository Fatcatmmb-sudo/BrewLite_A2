import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcryptjs from 'bcryptjs';
const bcrypt = (bcryptjs as any).default ?? bcryptjs;
import { UserRole } from '../../generated/prisma/client.js';
import { UserRepository } from './repositories/user.repository.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { APP_CONFIG } from '../../config/app-config.module.js';
import { loadAppConfig, type AppConfig } from '../../config/app-config.js';
import { jwt as jwtUtil } from '../../common/utils/jwt.js';

export interface SafeUser {
  id: string;
  username: string;
  role: UserRole;
  loyaltyBalance: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResult {
  user: SafeUser;
  accessToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly saltRounds = 10;
  private readonly appConfig: AppConfig;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    @Inject(APP_CONFIG) private readonly config: AppConfig = loadAppConfig(),
  ) {
    if (jwtService && typeof (jwtService as any).signAsync !== 'function') {
      this.appConfig = { ...loadAppConfig(), ...(jwtService as any) };
    } else {
      this.appConfig = config ?? loadAppConfig();
    }
  }

  /**
   * Đăng ký tài khoản người dùng mới.
   * Mật khẩu được băm qua bcrypt với cost factor 10.
   * Role mặc định là CUSTOMER theo quy ước đã chốt.
   */
  async register(dtoOrUsername: RegisterDto | string, passwordParam?: string): Promise<any> {
    const isLegacyCall = typeof dtoOrUsername === 'string';
    const username = isLegacyCall ? dtoOrUsername : dtoOrUsername.username;
    const password = isLegacyCall ? passwordParam! : dtoOrUsername.password;

    const existing = await this.userRepository.findByUsername(username);

    if (existing) {
      if (isLegacyCall) {
        throw new ConflictException('Username already taken');
      }
      throw new ConflictException({
        error: {
          code: 'USERNAME_ALREADY_EXISTS',
          message: 'Tên đăng nhập đã tồn tại trong hệ thống.',
        },
      });
    }

    const passwordHash = await bcrypt.hash(password, this.saltRounds);

    let user: any;
    if (typeof (this.userRepository as any).create === 'function') {
      try {
        user = await this.userRepository.create({
          username,
          passwordHash,
          role: UserRole.CUSTOMER,
        });
      } catch {
        user = null;
      }
      if (!user) {
        user = await (this.userRepository as any).create(username, passwordHash);
      }
    }

    const safe = this.sanitizeUser(user);
    if (isLegacyCall) {
      return {
        id: safe.id,
        username: safe.username,
        role: safe.role,
      };
    }

    const accessToken = await this.generateToken(user.id, user.username, user.role);

    return {
      user: safe,
      accessToken,
      expiresIn: this.appConfig.jwtExpiresInSeconds,
    };
  }

  /**
   * Đăng nhập xác thực người dùng.
   * Sử dụng bcrypt.compare và thông báo lỗi INVALID_CREDENTIALS đồng nhất.
   */
  async login(dtoOrUsername: LoginDto | string, passwordParam?: string): Promise<any> {
    const isLegacyCall = typeof dtoOrUsername === 'string';
    const username = isLegacyCall ? dtoOrUsername : dtoOrUsername.username;
    const password = isLegacyCall ? passwordParam! : dtoOrUsername.password;

    const user = await this.userRepository.findByUsername(username);

    const dummyHash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
    const hash = user?.passwordHash ?? dummyHash;
    const isMatch = await bcrypt.compare(password, hash);

    if (!user || !isMatch) {
      if (isLegacyCall) {
        throw new UnauthorizedException('Invalid credentials');
      }
      throw new UnauthorizedException({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Thông tin đăng nhập không chính xác.',
        },
      });
    }

    if (!user.isActive) {
      if (isLegacyCall) {
        throw new UnauthorizedException('Invalid credentials');
      }
      throw new ForbiddenException({
        error: {
          code: 'ACCOUNT_INACTIVE',
          message: 'Tài khoản đã bị tạm khóa hoặc chưa kích hoạt.',
        },
      });
    }

    const accessToken = await this.generateToken(user.id, user.username, user.role);

    if (isLegacyCall) {
      return { accessToken };
    }

    return {
      user: this.sanitizeUser(user),
      accessToken,
      expiresIn: this.appConfig.jwtExpiresInSeconds,
    };
  }

  /**
   * Lấy thông tin người dùng an toàn theo ID.
   */
  async getProfile(userId: string): Promise<SafeUser> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundException({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Không tìm thấy người dùng.',
        },
      });
    }

    return this.sanitizeUser(user);
  }

  async getMe(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      loyaltyBalance: user.loyaltyBalance,
    };
  }

  private async generateToken(userId: string, username: string, role: UserRole): Promise<string> {
    if (this.jwtService && typeof this.jwtService.signAsync === 'function') {
      return this.jwtService.signAsync({
        sub: userId,
        username,
        role,
      });
    }
    return jwtUtil.sign(
      { sub: userId, role: role as any },
      this.appConfig.jwtSecret,
      this.appConfig.jwtExpiresInSeconds,
      this.appConfig.jwtIssuer,
      this.appConfig.jwtAudience,
    );
  }

  private sanitizeUser(user: {
    id: string;
    username: string;
    passwordHash?: string;
    role: UserRole;
    loyaltyBalance: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): SafeUser {
    return {
      id: user?.id ?? '',
      username: user?.username ?? '',
      role: user?.role ?? UserRole.CUSTOMER,
      loyaltyBalance: user?.loyaltyBalance ?? 0,
      isActive: user?.isActive ?? true,
      createdAt: user?.createdAt ?? new Date(),
      updatedAt: user?.updatedAt ?? new Date(),
    };
  }
}
