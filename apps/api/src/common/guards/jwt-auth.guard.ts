import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Inject } from '@nestjs/common';
import { jwt } from '../utils/jwt.js';
import type { RequestWithUser } from '../decorators/current-user.decorator.js';
import type { AppConfig } from '../../config/app-config.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject('APP_CONFIG') private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser & { headers: Record<string, string | string[] | undefined> }>();
    const authHeader: string | undefined = request.headers['authorization'] as string | undefined;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('JWT token missing');
    }
    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, this.config.jwtSecret, this.config.jwtIssuer, this.config.jwtAudience);
      request.user = { ...payload, id: payload.sub };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return true;
  }
}
