import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MatchingEnginService } from '../services/order.matchingengin';
import { OrderType } from 'src/modules/database/entities';
import { QUEUE_PROCESSOR } from '../constants/queue';

@Processor(QUEUE_PROCESSOR.ORDER)
export class OrderConsumer extends WorkerHost {
  constructor(private readonly matchingService: MatchingEnginService) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { order, user_id } = await job.data;

    if (order.type === OrderType.MARKET) {
      this.matchingService.handleMarketOrder(order, user_id);
    }

    if (order.type === OrderType.LIMIT) {
      this.matchingService.handleLimitOrder(order, user_id);
    }
  }
}
