import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from '../utils/jwt.js';

export interface RequestWithUser {
  user: JwtPayload & { id: string };
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);
