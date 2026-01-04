import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { UserEntity } from './user.entity';
import { BaseEntity } from './base.entity';
import { MarketTokenEntity } from './market-token.entity';

@Entity('user_daily_pnl')
export class User_daily_pnlEntity extends BaseEntity {
  @ManyToOne(() => UserEntity, (user) => user.user_daily_pnls)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(
    () => MarketTokenEntity,
    (marketToken) => marketToken.user_dailyPnls,
  )
  @JoinColumn({ name: 'marketToken_id' })
  market_token: MarketTokenEntity;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    default: 0,
    nullable: false,
  })
  unrealized_pnl: string;
}
