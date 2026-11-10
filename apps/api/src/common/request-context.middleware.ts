import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

declare module 'express-serve-static-core' {
  interface Request { requestId?: string }
}

export function requestContext(request: Request, response: Response, next: NextFunction): void {
  const requestId = randomUUID();
  request.requestId = requestId;
  response.setHeader('X-Request-Id', requestId);
  const startedAt = process.hrtime.bigint();
  response.once('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const route = request.route?.path;
    process.stdout.write(`${JSON.stringify({
      timestamp: new Date().toISOString(), level: 'info', requestId,
      method: request.method, path: route ? `${request.baseUrl}${route}` : request.path,
      status: response.statusCode, errorCode: response.locals.errorCode ?? null,
      durationMs: Math.round(durationMs * 100) / 100,
    })}\n`);
  });
  next();
}
