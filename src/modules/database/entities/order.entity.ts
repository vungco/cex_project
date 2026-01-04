import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { TradeEntity } from './trade.entity';
import { MarketTokenEntity } from './market-token.entity';

export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum OrderType {
  MARKET = 'MARKET',
  LIMIT = 'LIMIT',
  STOP_LIMIT = 'STOP_LIMIT', // optional, nếu muốn stop order
}

export enum OrderStatus {
  NEW = 'NEW',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  FILLED = 'FILLED',
  CANCELLED = 'CANCELLED',
}

export enum TimeInForce {
  GTC = 'GTC', // Good-Til-Canceled
  IOC = 'IOC', // Immediate-Or-Cancel
  FOK = 'FOK', // Fill-Or-Kill
}

@Entity('orders')
@Index('idx_market_side_status_price', [
  'market_token',
  'side',
  'status',
  'price',
])
@Index('idx_user_created_at', ['user', 'createdAt'])
@Index('idx_market_token', ['market_token'])
export class OrderEntity {
  @PrimaryColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'enum', enum: OrderSide, nullable: false })
  side: OrderSide;

  @Column({ type: 'enum', enum: OrderType, nullable: false })
  type: OrderType;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  price: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  quantity: string; // Base token (BTC, ETH...)

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: false })
  quote_quantity: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  filled_quantity: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  filled_quote_quantity: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  avg_price?: string;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.NEW })
  status: string;

  @Column({ nullable: true })
  client_order_id?: string; // Unique identifier for the order

  @Column({ type: 'enum', enum: TimeInForce, nullable: true })
  time_in_force?: string; // GTC, IOC, FOK

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  stop_price?: string;

  @Column({ default: false })
  post_only?: boolean;

  @ManyToOne(() => MarketTokenEntity, (marketToken) => marketToken.orders)
  @JoinColumn({ name: 'marketToken_id' })
  market_token: MarketTokenEntity; // BTC/USDT, ETH/USDT...

  @ManyToOne(() => UserEntity, (user) => user.orders)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @OneToMany(() => TradeEntity, (trade) => trade.taker_order)
  taker_trade?: TradeEntity[];

  @OneToMany(() => TradeEntity, (trade) => trade.maker_order)
  maker_trade?: TradeEntity[];
}
