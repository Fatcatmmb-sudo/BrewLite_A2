import { Controller, Get, HttpException, HttpStatus, Inject, Optional } from '@nestjs/common';
import { HealthService } from './health.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { AppConfig } from '../../config/app-config.js';

@Controller('health')
export class HealthController {
  private readonly healthService?: HealthService;
  private readonly prisma?: PrismaService;
  private readonly config?: AppConfig;

  constructor(
    @Optional() serviceOrPrisma?: HealthService | PrismaService,
    @Optional() @Inject('APP_CONFIG') injectedConfig?: AppConfig,
  ) {
    if (serviceOrPrisma && 'check' in serviceOrPrisma) {
      this.healthService = serviceOrPrisma as HealthService;
    } else if (serviceOrPrisma) {
      this.prisma = serviceOrPrisma as PrismaService;
      this.config = injectedConfig;
    }
  }

  @Get()
  health() {
    if (this.healthService) {
      return this.healthService.check();
    }
    return this.readiness();
  }

  async readiness(): Promise<{ success: true; data: { status: 'ok' } }> {
    let timeout: NodeJS.Timeout | undefined;
    const timeoutMs = this.config?.healthTimeoutMs ?? 2000;
    try {
      const prisma = this.prisma ?? (this.healthService as any)?.prisma;
      const probePromise = prisma
        ? prisma.$queryRaw`SELECT 1`
        : Promise.resolve();

      await Promise.race([
        probePromise,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('health timeout')), timeoutMs);
        }),
      ]);
      return { success: true, data: { status: 'ok' } };
    } catch {
      throw new HttpException(
        { error: 'SERVICE_UNAVAILABLE', message: 'Service is not ready' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}
