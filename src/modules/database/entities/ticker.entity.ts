import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { MarketTokenEntity } from './market-token.entity';
import { BaseEntity } from './base.entity';

@Entity('tickers')
export class TickerEntity extends BaseEntity {
  @ManyToOne(() => MarketTokenEntity, (mt) => mt.tickers)
  @JoinColumn({ name: 'marketToken_id' })
  market_token: MarketTokenEntity;

  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: false })
  openPrice: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: false })
  lastPrice: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: false })
  priceChangePercent: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: false })
  highPrice: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: false })
  lowPrice: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: false })
  baseVolume: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: false })
  quoteVolume: string;
}
