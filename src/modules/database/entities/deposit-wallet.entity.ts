import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { TokenEntity } from './token.entity';
import { WalletEntity } from './wallet.entity';

@Entity({ name: 'deposit_wallet' })
export class DepositWalletEntity extends BaseEntity {
  @ManyToOne(() => TokenEntity, (token) => token.deposits)
  @JoinColumn({ name: 'token_id' })
  token: TokenEntity;

  @ManyToOne(() => WalletEntity, (wallet) => wallet.deposits, { eager: true })
  @JoinColumn({ name: 'wallet_id' })
  wallet: WalletEntity;
}
