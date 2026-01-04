import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { OrderEntity } from './order.entity';
import { WalletEntity } from './wallet.entity';
import { User_daily_pnlEntity } from './user-daily-pnl.entity';
import { LedgerEntity } from './ledger.entity';
import { TransactionHistoryEntity } from './transaction-history.entity';

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

@Entity('users')
@Index(['email', 'password'])
@Index(['email'])
export class UserEntity extends BaseEntity {
  @Column({ unique: true, nullable: false })
  email: string;

  @Column({ nullable: false })
  password: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: string;

  @OneToMany(() => WalletEntity, (wallet) => wallet.user)
  wallets: WalletEntity[];

  @OneToMany(() => OrderEntity, (order) => order.user)
  orders: OrderEntity[];

  @OneToMany(() => LedgerEntity, (ledger) => ledger.user)
  ledgers: LedgerEntity[];

  @OneToMany(() => User_daily_pnlEntity, (user_daily) => user_daily.user)
  user_daily_pnls: User_daily_pnlEntity[];

  @OneToMany(() => TransactionHistoryEntity, (withdrawal) => withdrawal.user)
  transactions: TransactionHistoryEntity[];
}
