import { Entity, Index } from 'typeorm';
import { BaseCandleEntity } from './baseCandle.entity';

@Entity('candles_1m')
@Index(['market_token', 'start_time'], { unique: true })
export class Candle1mEntity extends BaseCandleEntity {}
