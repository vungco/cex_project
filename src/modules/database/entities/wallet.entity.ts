import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { BalanceEntity } from './balance.entity';
import { UserEntity } from './user.entity';
import { BalanceLotEntity } from './balane_lot.entity';
import { DepositWalletEntity } from './deposit-wallet.entity';

export enum walletType {
  SPOT = 'SPOT',
  FUTURE = 'FUTURE',
  FUNDING = 'FUNDING',
}

@Entity('wallets')
@Index(['user', 'type'], { unique: true })
export class WalletEntity extends BaseEntity {
  @Column({
    type: 'enum',
    enum: walletType,
    default: walletType.FUNDING,
    nullable: false,
  })
  type: walletType;

  @Column({ nullable: false })
  name: string;

  @OneToMany(() => BalanceEntity, (balance) => balance.wallet)
  balances: BalanceEntity[];

  @OneToMany(() => BalanceLotEntity, (balance_lot) => balance_lot.wallet)
  balance_lots: BalanceLotEntity[];

  @OneToMany(() => DepositWalletEntity, (dep) => dep.wallet)
  deposits: DepositWalletEntity[];

  @ManyToOne(() => UserEntity, (user) => user.wallets, {
    onDelete: 'CASCADE',
    eager: true,
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
