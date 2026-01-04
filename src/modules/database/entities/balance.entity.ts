import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';
import { TokenEntity } from './token.entity';
import { WalletEntity } from './wallet.entity';

@Entity('balances')
@Unique(['token', 'wallet'])
@Index(['token', 'wallet'])
export class BalanceEntity extends BaseEntity {
  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  available: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  locked: string;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    default: 0,
    nullable: true,
  })
  avgPrice: string;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    default: 0,
    nullable: true,
  })
  costPrice: string;

  @ManyToOne(() => TokenEntity, (token) => token.balances)
  @JoinColumn({ name: 'token_id' })
  token: TokenEntity;

  @ManyToOne(() => WalletEntity, (wallet) => wallet.balances, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'wallet_id' })
  wallet: WalletEntity;
}
