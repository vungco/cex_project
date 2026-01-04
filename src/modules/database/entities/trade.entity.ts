import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { OrderEntity } from './order.entity';
import { MarketTokenEntity } from './market-token.entity';

@Entity('trades')
@Index(['market_token', 'createdAt'])
@Index(['maker_order'])
@Index(['taker_order'])
export class TradeEntity extends BaseEntity {
  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: false })
  price: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: false })
  quantity: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: false })
  quote_quantity: string;

  @ManyToOne(() => MarketTokenEntity, (market) => market.trades)
  @JoinColumn({ name: 'market_token_id' })
  market_token: MarketTokenEntity;

  @ManyToOne(() => OrderEntity, (order) => order.taker_trade)
  @JoinColumn({ name: 'taker_order_id' })
  taker_order: OrderEntity;

  @ManyToOne(() => OrderEntity, (order) => order.maker_trade)
  @JoinColumn({ name: 'maker_order_id' })
  maker_order: OrderEntity;
}
