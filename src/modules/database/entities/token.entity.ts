import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { MarketTokenEntity } from './market-token.entity';
import { BalanceEntity } from './balance.entity';
import { LedgerEntity } from './ledger.entity';
import { BalanceLotEntity } from './balane_lot.entity';
import { TransactionHistoryEntity } from './transaction-history.entity';
import { DepositWalletEntity } from './deposit-wallet.entity';

export const assetDefault = 'USDT';

@Entity('tokens')
@Index(['asset'])
export class TokenEntity extends BaseEntity {
  @Column({ unique: true, nullable: false, default: assetDefault })
  asset: string; // BTC, USDT, ETH...

  @Column({ nullable: false, unique: true })
  name: string;

  @Column({ nullable: false, default: false, type: 'boolean' })
  is_native: boolean;

  @OneToMany(() => MarketTokenEntity, (pair) => pair.baseToken)
  baseInPairs: MarketTokenEntity[];

  @OneToMany(() => MarketTokenEntity, (pair) => pair.quoteToken)
  quoteInPairs: MarketTokenEntity[];

  @OneToMany(() => BalanceEntity, (balance) => balance.token)
  balances: BalanceEntity[];

  @OneToMany(() => BalanceLotEntity, (balance_lot) => balance_lot.baseToken)
  balance_lots: BalanceEntity[];

  @OneToMany(() => LedgerEntity, (ledger) => ledger.token)
  ledgers: LedgerEntity[];

  @OneToMany(() => DepositWalletEntity, (deposit) => deposit.token)
  deposits: DepositWalletEntity[];

  @OneToMany(() => TransactionHistoryEntity, (withdrawal) => withdrawal.token)
  transactions: TransactionHistoryEntity[];
}
