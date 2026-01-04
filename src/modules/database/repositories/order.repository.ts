import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderEntity } from '../entities/order.entity';
import { DataSource, Repository } from 'typeorm';

@Injectable()
export class OrderRepository extends Repository<OrderEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(OrderEntity, dataSource.createEntityManager());
  }

  async findOnById(order_id: string): Promise<OrderEntity> {
    const order = await this.findOne({ where: { id: order_id } });
    if (!order) {
      throw new NotFoundException(`order ${order_id} not found`);
    }
    return order;
  }
}
