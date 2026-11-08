import { Controller, Get, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { AppConfig } from '../../config/app-config.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService, @Inject('APP_CONFIG') private readonly config: AppConfig) {}

  @Get()
  async readiness(): Promise<{ success: true; data: { status: 'ok' } }> {
    let timeout: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('health timeout')), this.config.healthTimeoutMs);
        }),
      ]);
      return { success: true, data: { status: 'ok' } };
    } catch {
      throw new HttpException({ error: 'SERVICE_UNAVAILABLE', message: 'Service is not ready' }, HttpStatus.SERVICE_UNAVAILABLE);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}
