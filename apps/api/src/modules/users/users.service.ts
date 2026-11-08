import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma, UserRole } from '../../generated/prisma/client.js';

export interface SafeUser {
  id: string;
  username: string;
  role: UserRole;
  loyaltyBalance: number;
  isActive: boolean;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  async findById(id: string): Promise<SafeUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, role: true, loyaltyBalance: true, isActive: true },
    });
    return user;
  }

  async create(username: string, passwordHash: string): Promise<SafeUser> {
    const user = await this.prisma.user.create({
      data: { username, passwordHash, role: 'CUSTOMER' },
      select: { id: true, username: true, role: true, loyaltyBalance: true, isActive: true },
    });
    return user;
  }

  async assertActiveCustomer(tx: Prisma.TransactionClient, id: string) {
    const user = await tx.user.findFirst({
      where: { id, isActive: true, role: 'CUSTOMER' },
      select: { id: true },
    });
    if (!user) throw new UnauthorizedException();
  }

  /**
   * JWT chỉ mang role tại thời điểm đăng nhập. Trước khi đổi trạng thái đơn,
   * xác nhận lại trong DB rằng tài khoản vẫn đang hoạt động và là BARISTA.
   */
  async assertActiveBarista(tx: Prisma.TransactionClient, id: string) {
    const user = await tx.user.findFirst({
      where: { id, isActive: true, role: 'BARISTA' },
      select: { id: true },
    });
    if (!user) throw new UnauthorizedException();
  }
}
