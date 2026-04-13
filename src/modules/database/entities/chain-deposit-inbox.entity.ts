import { Column, Entity } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity({ name: 'chain_deposit_inbox' })
export class ChainDepositInboxEntity extends BaseEntity {
  @Column({ name: 'idempotency_key', type: 'varchar', length: 256, unique: true })
  idempotencyKey: string;
}
