import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { TokenEntity } from './token.entity';

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
}

export enum TransactionStatus {
  PENDING = 'pending',
  BROADCASTED = 'broadcasted',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

@Entity({ name: 'transaction_history' })
export class TransactionHistoryEntity extends BaseEntity {
  @ManyToOne(() => UserEntity, (user) => user.transactions)
  user: UserEntity;

  @Column({ name: 'network_id', type: 'uuid' })
  networkId: string;

  @ManyToOne(() => TokenEntity, (token) => token.transactions)
  token: TokenEntity;

  @Column({ name: 'to_address', type: 'varchar', length: 100, nullable: true })
  excuAddress: string;

  @Column({ name: 'amount', type: 'decimal', precision: 20, scale: 8 })
  amount: string;

  @Column({ name: 'tx_hash', type: 'varchar', length: 100, nullable: true })
  txHash: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({
    name: 'type',
    type: 'enum',
    enum: TransactionType,
  })
  type: TransactionType;

  @Column({
    name: 'fee',
    type: 'decimal',
    precision: 20,
    scale: 8,
    default: 0,
  })
  fee: string;
}
