import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { TokenEntity } from './token.entity';

@Entity('realized_pnl_history')
export class RealizedPnlEntity extends BaseEntity {
  @ManyToOne(() => TokenEntity, (token) => token.balance_lots)
  @JoinColumn({ name: 'baseToken_id' })
  baseToken: TokenEntity;

  @Column({ type: 'decimal', precision: 30, scale: 10 })
  realized_pnl: string;

  @Column({ type: 'decimal', precision: 30, scale: 10, nullable: true })
  realized_pnl_percent: string | null;

  @Column({ type: 'decimal', precision: 30, scale: 10 })
  sell_price: string;

  @Column({ type: 'decimal', precision: 30, scale: 10 })
  lot_price: string;

  @Column({ type: 'decimal', precision: 30, scale: 10 })
  quantity: string;
}
