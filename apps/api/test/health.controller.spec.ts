import { describe, expect, it, vi } from 'vitest';
import { HttpException } from '@nestjs/common';
import { HealthController } from '../src/modules/health/health.controller.js';
import type { PrismaService } from '../src/database/prisma.service.js';

function makeController(query: () => Promise<unknown>, healthTimeoutMs = 200) {
  const prisma = { $queryRaw: query } as unknown as PrismaService;
  const config = { healthTimeoutMs } as never;
  return new HealthController(prisma, config);
}

async function expectUnavailable(operation: Promise<unknown>) {
  let error: unknown;
  try { await operation; } catch (caught) { error = caught; }
  expect(error).toBeInstanceOf(HttpException);
  expect((error as HttpException).getStatus()).toBe(503);
  expect((error as HttpException).getResponse()).toEqual({ error: 'SERVICE_UNAVAILABLE', message: 'Service is not ready' });
}

describe('HealthController.readiness', () => {
  it('returns ready after a successful database probe', async () => {
    const controller = makeController(vi.fn().mockResolvedValue([{ '?column?': 1 }]));
    await expect(controller.readiness()).resolves.toEqual({ success: true, data: { status: 'ok' } });
  });

  it('returns a generic 503 when the database probe fails', async () => {
    const controller = makeController(vi.fn().mockRejectedValue(new Error('database credentials leaked')));
    await expectUnavailable(controller.readiness());
  });

  it('returns a generic 503 when the probe times out', async () => {
    const controller = makeController(() => new Promise(() => undefined), 100);
    await expectUnavailable(controller.readiness());
  });
});
