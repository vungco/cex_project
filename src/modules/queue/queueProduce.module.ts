import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { OrderConsumer } from './consumer/order.consumer';
import { RedisModule } from '../redis/redis.module';
import { DatabaseModule } from '../database/database.module';
import { MatchingEnginService } from './services/order.matchingengin';
import { BalanceLotFifo } from './services/balance-lot.service';
import { QUEUE_PROCESSOR } from './constants/queue';
import { QueueService } from './services/queue.service';

const providers = [OrderConsumer, MatchingEnginService, BalanceLotFifo];

@Module({
  imports: [
    BullModule.registerQueue({
      name: QUEUE_PROCESSOR.ORDER,
    }),
    RedisModule,
    forwardRef(() => DatabaseModule),
  ],
  controllers: [],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueProduceModule {}
