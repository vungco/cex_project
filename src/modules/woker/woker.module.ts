import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../database/database.module';
import { SpotSchedulerService } from './schedules/schedules.service';
import { RedisModule } from '../redis/redis.module';
import { LoggerModule } from '../logger/logger.module';

@Module({
  imports: [ScheduleModule.forRoot(), DatabaseModule, RedisModule, LoggerModule],
  controllers: [],
  providers: [SpotSchedulerService],
})
export class WokerModule {}
