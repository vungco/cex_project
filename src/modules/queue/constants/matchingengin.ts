import Decimal from 'decimal.js';
import { OrderSide } from 'src/modules/database/entities';
import { redisOrder } from 'src/modules/redis/constans/redis';

export type matchingSide = {
  takerOrder: redisOrder;
  makerOrder: redisOrder;
  remainAsset: Decimal;
  price: Decimal;
  side: OrderSide;
};
