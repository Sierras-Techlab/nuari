import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { configureApp, getApiPort } from './app.config.js';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  await app.listen(getApiPort());
}
await bootstrap();
