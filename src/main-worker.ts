import { NestFactory } from '@nestjs/core';
import { AppWorkerModule } from './app-woker.module';

async function bootstrapWorker() {
  const app = await NestFactory.createApplicationContext(AppWorkerModule, {
    logger: ['log', 'error', 'warn'], // không cần debug nếu muốn
  });

  console.log('🚀 Worker started. Cronjobs are running...');
}

bootstrapWorker();
