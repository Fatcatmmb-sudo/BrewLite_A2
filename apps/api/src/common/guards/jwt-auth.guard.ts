import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { jwt } from '../utils/jwt.js';
import type { RequestWithUser } from '../decorators/current-user.decorator.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser & { headers: Record<string, string | string[] | undefined> }>();
    const authHeader: string | undefined = request.headers['authorization'] as string | undefined;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('JWT token missing');
    }
    const token = authHeader.slice(7);
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new UnauthorizedException('Server configuration error');
    try {
      request.user = jwt.verify(token, secret);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return true;
  }
}
