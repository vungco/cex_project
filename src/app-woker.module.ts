import { Module } from '@nestjs/common';
import { DatabaseModule } from './modules/database/database.module';
import { LoggerModule } from './modules/logger/logger.module';
import { QueueModule } from './modules/queue/queue.module';
import { RedisModule } from './modules/redis/redis.module';
import { WokerModule } from './modules/woker/woker.module';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { env } from './utils';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    LoggerModule,
    QueueModule,
    RedisModule,
    WokerModule,
    BullModule.forRootAsync({
      useFactory: () => {
        return {
          connection: {
            host: env.REDIS_HOST,
            port: env.REDIS_PORT,
            db: env.REDIS_DATABASE ? Number(env.REDIS_DATABASE) : 0,
            password: env.REDIS_PASSWORD,
          },
        };
      },
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppWorkerModule {}
