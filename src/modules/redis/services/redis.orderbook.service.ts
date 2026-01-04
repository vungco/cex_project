import { Injectable, NotFoundException } from '@nestjs/common';
import { RedisBaseService } from './redis.base.service';
import { OrderSide } from 'src/modules/database/entities';
import { OrderEventTypeChange } from 'src/shared/enums/enum';
import {
  orderBook_key,
  OrderBookResponse,
  redisOrder,
} from '../constans/redis';
import Decimal from 'decimal.js';

@Injectable()
export class RedisOrderBookService {
  constructor(private readonly redisBase: RedisBaseService) {}

  private get redis() {
    return this.redisBase.redis;
  }
  private get publisher() {
    return this.redisBase.publisher;
  }

  private getKey(symbol: string, side: OrderSide) {
    return `${orderBook_key}:${symbol}:${side}`;
  }

  private getOrderPubEvent(type: OrderEventTypeChange, symbol: string) {
    return `${symbol}:order:${type}`;
  }

  private getPriceListKey(symbol: string, side: OrderSide, price: string) {
    return `order:${symbol}:${side}:${price}`;
  }

  private getUserOrdersKey(user_id: string, symbol: string) {
    return `userOrders:${user_id}:${symbol}`;
  }

  private getLastUpdateIdKey(symbol: string) {
    return `orderBook:${symbol}:lastUpdateId`;
  }

  async addOrder(symbol: string, side: OrderSide, order: redisOrder) {
    const bookKey = this.getKey(symbol, side);
    const listKey = this.getPriceListKey(symbol, side, order.price);
    const userKey = this.getUserOrdersKey(order.user.id, symbol);

    await this.redis.zadd(bookKey, order.price, order.price);
    await this.redis.rpush(listKey, JSON.stringify(order));
    await this.redis.hset(userKey, order.id, JSON.stringify(order));

    await this.incrementLastUpdateId(symbol);
  }

  async updateOrder(
    symbol: string,
    side: OrderSide,
    orderId: string,
    oldPrice: string,
    newOrder: redisOrder,
  ) {
    await this.deleteOrder(symbol, side, orderId, oldPrice, newOrder.user.id);

    if (newOrder) {
      const listKey = this.getPriceListKey(symbol, side, newOrder.price);
      const userKey = this.getUserOrdersKey(newOrder.user.id, symbol);
      await this.redis.zadd(
        this.getKey(symbol, side),
        newOrder.price,
        newOrder.price,
      );
      await this.redis.rpush(listKey, JSON.stringify(newOrder));
      await this.redis.hset(userKey, newOrder.id, JSON.stringify(newOrder));
    }

    await this.incrementLastUpdateId(symbol);
  }

  async deleteOrder(
    symbol: string,
    side: OrderSide,
    orderId: string,
    price: string,
    user_id: string,
  ) {
    const listKey = this.getPriceListKey(symbol, side, price);
    const ordersJson = await this.redis.lrange(listKey, 0, -1);

    for (const o of ordersJson) {
      const order: redisOrder = JSON.parse(o);
      if (order.id === orderId) {
        await this.redis.lrem(listKey, 1, o);
        break;
      }
    }

    if ((await this.redis.llen(listKey)) === 0) {
      await this.redis.del(listKey);
      await this.redis.zrem(this.getKey(symbol, side), price);
    }

    const userKey = this.getUserOrdersKey(user_id, symbol);
    await this.redis.hdel(userKey, orderId);

    await this.incrementLastUpdateId(symbol);
  }

  async incrementLastUpdateId(symbol: string) {
    return this.redis.incr(this.getLastUpdateIdKey(symbol));
  }

  async getLastUpdateId(symbol: string) {
    const id = await this.redis.get(this.getLastUpdateIdKey(symbol));
    return id ? Number(id) : 0;
  }

  async getOrderBook(
    symbol: string,
    side: OrderSide,
  ): Promise<OrderBookResponse> {
    const key = this.getKey(symbol, side);
    const isBuy = side === OrderSide.BUY;

    const levels = isBuy
      ? await this.redis.zrevrange(key, 0, -1, 'WITHSCORES')
      : await this.redis.zrange(key, 0, -1, 'WITHSCORES');

    const result: OrderBookResponse = [];
    for (let i = 0; i < levels.length; i += 2) {
      const price = new Decimal(levels[i + 1]).toDecimalPlaces(8).toString();
      const listKey = this.getPriceListKey(symbol, side, price);
      const ordersJson = await this.redis.lrange(listKey, 0, -1);
      const orders: redisOrder[] = ordersJson.map((o) => JSON.parse(o));
      result.push({ price, orders });
    }

    return result;
  }

  async getPublicOrderBook(
    symbol: string,
    depth: number,
  ): Promise<{
    lastUpdateId: number;
    bids: [string, string][];
    asks: [string, string][];
  }> {
    const [bids, asks, lastUpdateId] = await Promise.all([
      this.getTopLevels(symbol, OrderSide.BUY, depth),
      this.getTopLevels(symbol, OrderSide.SELL, depth),
      this.getLastUpdateId(symbol),
    ]);

    return {
      lastUpdateId,
      bids,
      asks,
    };
  }

  private async getTopLevels(
    symbol: string,
    side: OrderSide,
    depth: number,
  ): Promise<[string, string][]> {
    const key = this.getKey(symbol, side);
    const isBuy = side === OrderSide.BUY;

    const priceLevels = isBuy
      ? await this.redis.zrevrange(key, 0, depth - 1, 'WITHSCORES')
      : await this.redis.zrange(key, 0, depth - 1, 'WITHSCORES');

    const result: [string, string][] = [];

    for (let i = 0; i < priceLevels.length; i += 2) {
      const price = new Decimal(priceLevels[i + 1]).toDecimalPlaces(8);
      const listKey = this.getPriceListKey(symbol, side, price.toString());
      const ordersJson = await this.redis.lrange(listKey, 0, -1);

      let totalQuantity = new Decimal(0);
      for (const o of ordersJson) {
        const order: redisOrder = JSON.parse(o);

        totalQuantity = totalQuantity.add(
          new Decimal(order.quantity).sub(order.filled_quantity),
        );
      }

      if (totalQuantity.greaterThan(0)) {
        result.push([price.toFixed(2), totalQuantity.toFixed(6)]);
      }
    }

    return result;
  }

  async getUserOrders(user_id: string, symbol: string): Promise<redisOrder[]> {
    const userKey = this.getUserOrdersKey(user_id, symbol);
    const orders = await this.redis.hvals(userKey);
    return orders.map((o) => JSON.parse(o) as redisOrder);
  }

  async getOrderByUser(
    order_id: string,
    user_id: string,
    symbol: string,
  ): Promise<redisOrder> {
    const orders = await this.getUserOrders(user_id, symbol);

    for (const order of orders) {
      if (order.id == order_id) {
        return order;
      }
    }

    throw new NotFoundException(`order_id not found for user ${user_id}`);
  }
}
