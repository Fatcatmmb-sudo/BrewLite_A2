import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : undefined;
    let code = status === 500 ? 'INTERNAL_ERROR' : 'HTTP_ERROR';
    let message = status === 500 ? 'An unexpected error occurred' : 'Request failed';
    if (body && typeof body === 'object') {
      const payload = body as {
        code?: unknown;
        error?: string | { code?: unknown; message?: unknown };
        message?: unknown;
      };
      const details = typeof payload.error === 'object' && payload.error !== null ? payload.error : payload;
      const namedError = typeof details.message === 'string' && /^[A-Z]+(?:_[A-Z]+)+$/.test(details.message);
      const errorCode = details.code ?? (namedError ? details.message : payload.error);
      if (typeof errorCode === 'string') code = errorCode.toUpperCase().replaceAll(' ', '_');
      if (typeof details.message === 'string') message = details.message;
      if (Array.isArray(details.message)) message = 'Request validation failed';
    }
    response.locals.errorCode = code;
    response.status(status).json({ success: false, error: { code, message, requestId: request.requestId } });
  }
}
