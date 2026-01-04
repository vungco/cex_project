import { Entity, Index } from 'typeorm';
import { BaseCandleEntity } from './baseCandle.entity';

@Entity('candles_15m')
@Index(['market_token', 'start_time'], { unique: true })
export class Candle15mEntity extends BaseCandleEntity {}
