import './polyfill-crypto';
import { NestFactory } from '@nestjs/core';
import { AppWorkerModule } from './app-woker.module';

async function bootstrapWorker() {
  const isDev = process.env.NODE_ENV === 'development';
  const app = await NestFactory.createApplicationContext(AppWorkerModule, {
    logger: isDev
      ? (['log', 'error', 'warn', 'debug'] as const)
      : (['log', 'error', 'warn'] as const),
  });

  console.log('🚀 Worker started. Cronjobs are running...');
}

bootstrapWorker();
