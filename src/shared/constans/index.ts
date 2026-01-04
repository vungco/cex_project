import { TickerEntity } from 'src/modules/database/entities';

export const timeFrameCandles: string[] = ['1m', '5m', '15m'];

export interface CandleData {
  symbol: string;
  interval: string; // "1m" | "5m" | "10m"
  o: string;
  h: string;
  l: string;
  c: string;
  volume: string;
  startTime: number;
  endTime: number;
  tradeCount: number;
  isClosed: boolean;
}

export type tickerRedis = Omit<
  TickerEntity,
  'id' | 'createdAt' | 'market_token'
> & {
  openPrice: string;
  symbol: string;
};

export * from './user';
export * from './wallet';
