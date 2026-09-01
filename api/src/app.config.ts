import type { INestApplication } from '@nestjs/common';

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
    return configuredOrigin.replace(/\/+$/, '');
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
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: webOrigin,
    credentials: true,
  });
}
