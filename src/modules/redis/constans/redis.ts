import {
  BalanceEntity,
  LedgerEntity,
  OrderEntity,
  TradeEntity,
} from 'src/modules/database/entities';
import { BalanceLotEntity } from 'src/modules/database/entities/balane_lot.entity';

export const orderBook_key = 'orderbook';

export type redisOrder = Omit<OrderEntity, 'createdAt' | 'updatedAt'>;

export type redisTrade = Omit<TradeEntity, 'createdAt' | 'updatedAt' | 'id'> & {
  tradeTime: number;
};

export type redisBalance = Omit<
  BalanceEntity,
  'createdAt' | 'updatedAt' | 'id'
>;

export type redisLedger = Omit<LedgerEntity, 'createdAt' | 'updatedAt' | 'id'>;

export type OrderBookLevel = {
  price: string;
  orders: redisOrder[];
};
export type redisBalanceLot = Omit<
  BalanceLotEntity,
  'createdAt' | 'updatedAt' | 'id'
>;

export type OrderBookResponse = OrderBookLevel[];

export type sumaryTicker = {
  symbol: string;
  lastPrice: string;
  change24h: string;
  updatedAt: Date;
};
