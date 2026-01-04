import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { TokenEntity } from './token.entity';
import { UserEntity } from './user.entity';

export enum LedgerReason {
  DEPOSIT = 'DEPOSIT',
  WITHDRAW = 'WITHDRAW',
  BUY = 'BUY',
  SELL = 'SELL',
  TRADE_FILL = 'TRADE_FILL',
  TRANSFERMONEY = 'TRANSFERMONEY',
  CONVERT = 'CONVERT',
  REFUND = 'REFUND',
}

export enum descriptionType {
  SUCCESSFUL = 'SUCCESSFUL',
  CANCLE = 'CANCLE',
  FUNGDINGSPOT = 'FUNGDING => SPOT',
  FUNGDINGFUTURE = 'FUNGDING => FUTURE',
  SPOTFUNDING = 'SPOT => FUNGDING',
  SPOTFUTURE = 'SPOT => FUTURE',
  FUTUREFUNGDING = 'FUTURE => FUNGDING',
  FUTURESPOT = 'FUTURE => SPOT',
}

@Entity('ledgers')
@Index(['token', 'user'])
@Index(['user'])
export class LedgerEntity extends BaseEntity {
  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: false })
  delta: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  priceUsdt: string | null;

  @Column({
    nullable: false,
    type: 'enum',
    enum: LedgerReason,
  })
  reason: LedgerReason;

  @Column({ type: 'enum', enum: descriptionType, nullable: false })
  description: descriptionType;

  @ManyToOne(() => TokenEntity, (token) => token.balances)
  @JoinColumn({ name: 'token_id' })
  token: TokenEntity;

  @ManyToOne(() => UserEntity, (user) => user.ledgers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'wallet_id' })
  user: UserEntity;
}
