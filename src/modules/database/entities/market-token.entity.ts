import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { TokenEntity } from './token.entity';
import { OrderEntity } from './order.entity';
import { TradeEntity } from './trade.entity';
import { TickerEntity } from './ticker.entity';
import { User_daily_pnlEntity } from './user-daily-pnl.entity';

@Entity('market_tokens')
@Index(['symbol'])
export class MarketTokenEntity extends BaseEntity {
  @ManyToOne(() => TokenEntity, (token) => token.baseInPairs)
  @JoinColumn({ name: 'baseToken_id' })
  baseToken: TokenEntity;

  @ManyToOne(() => TokenEntity, (token) => token.quoteInPairs)
  @JoinColumn({ name: 'quoteToken_id' })
  quoteToken: TokenEntity;

  @Column({ unique: true })
  symbol: string; // BTCUSDT

  @Column({ default: false, nullable: false })
  isActive: boolean;

  @OneToMany(() => OrderEntity, (order) => order.market_token)
  orders: OrderEntity[];

  @OneToMany(() => TradeEntity, (trade) => trade.market_token)
  trades: TradeEntity[];

  @OneToMany(() => TickerEntity, (ticker) => ticker.market_token)
  tickers: TickerEntity[];

  @OneToMany(
    () => User_daily_pnlEntity,
    (user_daily_pnl) => user_daily_pnl.market_token,
  )
  user_dailyPnls: User_daily_pnlEntity[];
}
