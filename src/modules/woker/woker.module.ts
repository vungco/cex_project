import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../database/database.module';
import { SpotSchedulerService } from './schedules/schedules.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [ScheduleModule.forRoot(), DatabaseModule, RedisModule],
  controllers: [],
  providers: [SpotSchedulerService],
})
export class WokerModule {}
