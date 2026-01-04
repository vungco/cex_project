import { Module } from '@nestjs/common';
import { ApiModule } from './modules/api/api.module';
import { DatabaseModule } from './modules/database/database.module';
import { LoggerModule } from './modules/logger/logger.module';
import { RedisModule } from './modules/redis/redis.module';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { env } from './utils';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ApiModule,
    DatabaseModule,
    LoggerModule,
    RedisModule,
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
export class AppModule {}
