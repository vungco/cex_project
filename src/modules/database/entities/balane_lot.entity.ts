import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { WalletEntity } from './wallet.entity';
import { TokenEntity } from './token.entity';

export enum lotType {
  SPOT = 'SPOT',
  FUNDING = 'FUNDING',
  CONVERT = 'CONVERT',
}

@Entity('balance_lots')
export class BalanceLotEntity extends BaseEntity {
  @ManyToOne(() => WalletEntity, (wallet) => wallet.balance_lots)
  @JoinColumn({ name: 'wallet_id' })
  wallet: WalletEntity;

  @ManyToOne(() => TokenEntity, (token) => token.balance_lots)
  @JoinColumn({ name: 'baseToken_id' })
  baseToken: TokenEntity;

  @Column({ type: 'decimal', precision: 30, scale: 8, default: '0' })
  quantity: string;

  @Column({ type: 'decimal', precision: 30, scale: 8 })
  price: string;

  @Column({
    type: 'enum',
    enum: lotType,
    default: lotType.SPOT,
    nullable: false,
  })
  type: lotType;
}
