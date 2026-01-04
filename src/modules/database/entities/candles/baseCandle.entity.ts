import {
  Column,
  ManyToOne,
  JoinColumn,
  BaseEntity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MarketTokenEntity } from '../market-token.entity';

export abstract class BaseCandleEntity extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'bigint', nullable: false })
  start_time: number;

  @Column({ type: 'bigint', nullable: false })
  end_time: number;

  @ManyToOne(() => MarketTokenEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'market_token_id' })
  market_token: MarketTokenEntity;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: false })
  o: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: false })
  h: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: false })
  l: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: false })
  c: string;

  @Column({
    type: 'decimal',
    precision: 30,
    scale: 8,
    nullable: false,
    default: 0,
  })
  volume: string;

  @Column({ type: 'int', nullable: false, default: 0 })
  trades_count: number;
}
