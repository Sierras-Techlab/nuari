import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { json, type Request, type Response, type NextFunction } from 'express';
import { ApiError, ApiExceptionFilter } from './common/errors.js';
import { SecurityConfig, validateOrigin } from './common/security.config.js';

const DEVELOPMENT_WEB_ORIGIN = 'http://localhost:3000';
const DEFAULT_API_PORT = 3001;

type ApiEnvironment = {
  NODE_ENV?: string;
  PORT?: string;
  WEB_ORIGIN?: string;
};

export function getWebOrigin(env: ApiEnvironment = process.env): string {
  const configuredOrigin = env.WEB_ORIGIN?.trim();

  if (configuredOrigin) {
    return validateOrigin(configuredOrigin, env.NODE_ENV === 'production');
  }

  if (env.NODE_ENV !== 'production') {
    return DEVELOPMENT_WEB_ORIGIN;
  }

  throw new Error('WEB_ORIGIN is required when the API runs in production.');
}

export function getApiPort(env: ApiEnvironment = process.env): number {
  if (!env.PORT) {
    return DEFAULT_API_PORT;
  }

  const port = Number(env.PORT);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return port;
}

export function configureApp(
  app: INestApplication,
  webOrigin = getWebOrigin(),
): void {
  const exactOrigin = validateOrigin(webOrigin, process.env.NODE_ENV === 'production');
  const config = app.get(SecurityConfig);
  app.getHttpAdapter().getInstance().set('trust proxy', config.trustedProxies.length ? config.trustedProxies : false);
  app.setGlobalPrefix('api');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' }, referrerPolicy: { policy: 'no-referrer' } }));
  app.use(cookieParser());
  app.use(json({ limit: '16kb' }));
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.enableCors({
    origin: exactOrigin,
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({
    transform: true, whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: false,
    transformOptions: { enableImplicitConversion: false }, validationError: { target: false, value: false },
    exceptionFactory: (errors: ValidationError[]) => {
      const fieldErrors: Record<string, string[]> = {};
      for (const error of errors) fieldErrors[error.property] = ['El valor no es válido o el campo no está permitido.'];
      return new ApiError(400, 'VALIDATION_ERROR', 'Revisá los campos indicados.', fieldErrors);
    },
  }));
  app.useGlobalFilters(new ApiExceptionFilter());
}
