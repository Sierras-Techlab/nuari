import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';

export class ApiError extends HttpException {
  constructor(status: number, code: string, message: string, fieldErrors?: Record<string, string[]>, readonly retryAfter?: number) {
    super({ code, message, ...(fieldErrors ? { fieldErrors } : {}) }, status);
  }
}

export const unauthenticated = (): ApiError => new ApiError(401, 'UNAUTHENTICATED', 'Iniciá sesión para continuar.');
export const invalidToken = (): ApiError => new ApiError(400, 'INVALID_TOKEN', 'El enlace no es válido o venció.');

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    response.setHeader('Cache-Control', 'no-store');
    if (exception instanceof ApiError) {
      if (exception.retryAfter) response.setHeader('Retry-After', exception.retryAfter);
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }
    const unavailable = exception instanceof Prisma.PrismaClientInitializationError ||
      (exception instanceof Prisma.PrismaClientKnownRequestError && ['P1001', 'P1002', 'P1008', 'P1017', 'P2024'].includes(exception.code));
    if (unavailable) {
      response.status(503).json({ code: 'SERVICE_UNAVAILABLE', message: 'El servicio no está disponible. Intentá nuevamente.' });
      return;
    }
    if (exception instanceof HttpException || (typeof exception === 'object' && exception !== null && 'status' in exception)) {
      const status = exception instanceof HttpException ? exception.getStatus() : Reflect.get(exception, 'status');
      if (typeof status === 'number' && status >= 400 && status < 500) {
        response.status(status).json({ code: status === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR', message: 'La solicitud no es válida.' });
        return;
      }
    }
    // Do not log messages, query parameters, stack traces or request bodies.
    this.logger.error('internal_error');
    response.status(500).json({ code: 'INTERNAL_ERROR', message: 'No se pudo completar la solicitud.' });
  }
}
