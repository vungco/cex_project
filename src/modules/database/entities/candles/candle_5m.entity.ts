import { Entity, Index } from 'typeorm';
import { BaseCandleEntity } from './baseCandle.entity';

@Entity('candles_5m')
@Index(['market_token', 'start_time'], { unique: true })
export class Candle5mEntity extends BaseCandleEntity {}
