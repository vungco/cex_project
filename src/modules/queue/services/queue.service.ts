import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { QUEUE_PROCESS, QUEUE_PROCESSOR } from '../constants/queue';
import { Queue, tryCatch } from 'bullmq';
import { OrderDtoCreate } from 'src/modules/api/dtos';

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue(QUEUE_PROCESSOR.ORDER) private readonly orderQueue: Queue,
  ) {}

  async addOrderJob(order: OrderDtoCreate, user_id: string): Promise<boolean> {
    try {
      await this.orderQueue.add(QUEUE_PROCESS.ORDERCREATE, { order, user_id });
      return true;
    } catch (error) {
      return false;
    }
  }
}
