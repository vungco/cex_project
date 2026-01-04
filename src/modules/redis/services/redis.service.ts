// import { Injectable } from '@nestjs/common';
// import Redis from 'ioredis';
// import { env } from 'process';
// import {
//   orderBook_key,
//   OrderBookResponse,
//   redisOrder,
//   sumaryTicker,
// } from '../constans/redis';
// import { OrderSide } from 'src/modules/database/entities';
// import { CandleData, tickerRedis } from 'src/shared/constans';
// import Decimal from 'decimal.js';

// @Injectable()
// export class RedisService {
//   private readonly redis: Redis;
//   private readonly publisher: Redis;
//   private readonly subscriber: Redis;

//   constructor() {
//     const config = {
//       host: env.REDIS_HOST ?? 'localhost',
//       port: env.REDIS_PORT ? parseInt(env.REDIS_PORT) : 6379,
//       db: env.REDIS_DATABASE ? parseInt(env.REDIS_DATABASE) : 0,
//       password: env.REDIS_PASSWORD,
//     };

//     this.redis = new Redis(config);
//     this.publisher = new Redis(config);
//     this.subscriber = new Redis(config);
//   }

//   // ------------------ 🔥 PUB/SUB ------------------

//   /** send event (publish) */
//   async publish(channel: string, message: string) {
//     await this.publisher.publish(channel, message);
//   }

//   /** listen event (subscribe) */
//   subscribe(channel: string, callback: (message: string) => void) {
//     this.subscriber.subscribe(channel, (err) => {
//       if (err) console.error(`❌ Failed to subscribe to ${channel}`, err);
//       else console.log(`✅ Subscribed to channel: ${channel}`);
//     });

//     this.subscriber.on('message', (ch, message) => {
//       if (ch === channel) callback(message);
//     });
//   }

//   async disconnect() {
//     await this.subscriber.quit();
//     await this.publisher.quit();
//   }

//   async get(key: string): Promise<string | null> {
//     return this.redis.get(key);
//   }

//   /**
//    * Set a value in Redis with optional TTL
//    * @param key Redis key
//    * @param value Value to store
//    * @param ttlSeconds Time to live in seconds (optional)
//    */
//   async set(key: string, value: string, ttlSeconds?: number): Promise<'OK'> {
//     if (ttlSeconds) {
//       return this.redis.setex(key, ttlSeconds, value);
//     }
//     return this.redis.set(key, value);
//   }

//   get client(): Redis {
//     return this.redis;
//   }

//   async mget(keys: string[]): Promise<(string | null)[]> {
//     if (keys.length === 0) return [];
//     return this.redis.mget(...keys);
//   }

//   /**
//    * Set multiple key-value pairs using a pipeline for better performance
//    * @param entries Array of {key, value, ttl?} objects
//    * @returns Array of results
//    */
//   async mset(
//     entries: Array<{ key: string; value: string; ttl?: number }>,
//   ): Promise<string[]> {
//     if (entries.length === 0) return [];

//     const pipeline = this.redis.pipeline();

//     for (const { key, value, ttl } of entries) {
//       if (ttl) {
//         pipeline.setex(key, ttl, value);
//       } else {
//         pipeline.set(key, value);
//       }
//     }

//     const results = await pipeline.exec();
//     return results?.map((result) => String(result[1])) || [];
//   }

//   // handle orderbook example : orderbook:BY|SELL
//   private getKey(symbol: string, side: OrderSide) {
//     // example: orderBook:BTCUSDT:BUY
//     return `${orderBook_key}:${symbol}:${side}`;
//   }

//   private getPriceListKey(symbol: string, side: OrderSide, price: string) {
//     // example: order:BTCUSDT:BUY:30000
//     return `order:${symbol}:${side}:${price}`;
//   }

//   private getUserOrdersKey(user_id: string, symbol: string) {
//     return `userOrders:${user_id}:${symbol}`;
//   }

//   async getOrderBook(
//     symbol: string,
//     side: OrderSide,
//   ): Promise<OrderBookResponse> {
//     const key = this.getKey(symbol, side);
//     const isBuy = side === OrderSide.BUY;

//     const levels = isBuy
//       ? await this.redis.zrevrange(key, 0, -1, 'WITHSCORES')
//       : await this.redis.zrange(key, 0, -1, 'WITHSCORES');

//     const result: OrderBookResponse = [];
//     for (let i = 0; i < levels.length; i += 2) {
//       const price = new Decimal(levels[i + 1]).toDecimalPlaces(8).toString();

//       const listKey = this.getPriceListKey(symbol, side, price);
//       const ordersJson = await this.redis.lrange(listKey, 0, -1);
//       const orders: redisOrder[] = ordersJson.map(
//         (o) => JSON.parse(o) as redisOrder,
//       );
//       result.push({ price, orders });
//     }
//     return result;
//   }

//   async addOrder(symbol: string, side: OrderSide, order: redisOrder) {
//     const bookKey = this.getKey(symbol, side);
//     const listKey = this.getPriceListKey(
//       symbol,
//       side,
//       new Decimal(order.price).toString(),
//     );

//     await this.redis.zadd(
//       bookKey,
//       new Decimal(order.price).toString(),
//       new Decimal(order.price).toString(),
//     );
//     await this.redis.rpush(listKey, JSON.stringify(order));

//     const userKey = this.getUserOrdersKey(order.user.id, symbol);
//     await this.redis.hset(userKey, order.id, JSON.stringify(order));

//     await this.incrementLastUpdateId(symbol);

//     await this.publish(OrderEventType.NEW, JSON.stringify(order));
//   }

//   async updateOrder(
//     symbol: string,
//     side: OrderSide,
//     orderId: string,
//     oldPrice: string,
//     newOrder: redisOrder,
//   ) {
//     const bookKey = this.getKey(symbol, side);

//     await this.deleteOrder(symbol, side, orderId, oldPrice, newOrder.user.id);

//     if (newOrder) {
//       const listKey = this.getPriceListKey(symbol, side, newOrder.price!);
//       const userKey = this.getUserOrdersKey(newOrder.user.id, symbol);

//       await this.redis.zadd(
//         bookKey,
//         newOrder.price!,
//         newOrder.price!.toString(),
//       );
//       await this.redis.rpush(listKey, JSON.stringify(newOrder));
//       await this.redis.hset(userKey, newOrder.id, JSON.stringify(newOrder));
//     }
//     await this.incrementLastUpdateId(symbol);

//     await this.publish(OrderEventType.UPDATE, JSON.stringify(newOrder));
//   }

//   async deleteOrder(
//     symbol: string,
//     side: OrderSide,
//     orderId: string,
//     price: string,
//     user_id: string,
//   ) {
//     const bookKey = this.getKey(symbol, side);
//     const listKey = this.getPriceListKey(symbol, side, price);

//     const ordersJson = await this.redis.lrange(listKey, 0, -1);
//     for (let i = 0; i < ordersJson.length; i++) {
//       const order: redisOrder = JSON.parse(ordersJson[i]);
//       if (order.id === orderId) {
//         await this.redis.lrem(listKey, 1, ordersJson[i]);
//         break;
//       }
//     }

//     const length = await this.redis.llen(listKey);
//     if (length === 0) {
//       await this.redis.del(listKey);
//       await this.redis.zrem(bookKey, price.toString());
//     }

//     const userKey = this.getUserOrdersKey(user_id, symbol);
//     await this.redis.hdel(userKey, orderId);

//     await this.incrementLastUpdateId(symbol);

//     await this.publish(OrderEventType.DELETE, JSON.stringify(orderId));
//   }

//   /** orderBookPublic */
//   private getLastUpdateIdKey(symbol: string) {
//     return `orderBook:${symbol}:lastUpdateId`;
//   }

//   async incrementLastUpdateId(symbol: string): Promise<number> {
//     return this.redis.incr(this.getLastUpdateIdKey(symbol));
//   }

//   async getLastUpdateId(symbol: string): Promise<number> {
//     const id = await this.redis.get(this.getLastUpdateIdKey(symbol));
//     return id ? Number(id) : 0;
//   }

//   async getPublicOrderBook(
//     symbol: string,
//     depth: number,
//   ): Promise<{
//     lastUpdateId: number;
//     bids: [string, string][];
//     asks: [string, string][];
//   }> {
//     const [bids, asks, lastUpdateId] = await Promise.all([
//       this.getTopLevels(symbol, OrderSide.BUY, depth),
//       this.getTopLevels(symbol, OrderSide.SELL, depth),
//       this.getLastUpdateId(symbol),
//     ]);

//     return {
//       lastUpdateId,
//       bids,
//       asks,
//     };
//   }

//   private async getTopLevels(
//     symbol: string,
//     side: OrderSide,
//     depth: number,
//   ): Promise<[string, string][]> {
//     const key = this.getKey(symbol, side);
//     const isBuy = side === OrderSide.BUY;

//     const priceLevels = isBuy
//       ? await this.redis.zrevrange(key, 0, depth - 1, 'WITHSCORES')
//       : await this.redis.zrange(key, 0, depth - 1, 'WITHSCORES');

//     const result: [string, string][] = [];

//     for (let i = 0; i < priceLevels.length; i += 2) {
//       const price = new Decimal(priceLevels[i + 1]).toDecimalPlaces(8);
//       const listKey = this.getPriceListKey(symbol, side, price.toString());
//       const ordersJson = await this.redis.lrange(listKey, 0, -1);

//       let totalQuantity = new Decimal(0);
//       for (const o of ordersJson) {
//         const order: redisOrder = JSON.parse(o);

//         totalQuantity = totalQuantity.add(
//           new Decimal(order.quantity).sub(order.filled_quantity),
//         );
//       }

//       if (totalQuantity.greaterThan(0)) {
//         result.push([price.toFixed(2), totalQuantity.toFixed(6)]);
//       }
//     }

//     return result;
//   }

//   // ------------------ 🔥 CANDLE ------------------

//   private getCandleKey(symbol: string, interval: string) {
//     return `candle:${symbol}:${interval}:current`;
//   }

//   private getCandleChannel(symbol: string, interval: string) {
//     return `channel:candle:${symbol}:${interval}`;
//   }

//   /**
//    * Lấy candle hiện tại (có thể chưa chốt)
//    */
//   async getCandle(
//     symbol: string,
//     interval: string,
//   ): Promise<CandleData | null> {
//     const data = await this.redis.get(this.getCandleKey(symbol, interval));
//     return data ? (JSON.parse(data) as CandleData) : null;
//   }

//   /**
//    * Cập nhật candle realtime khi có trade mới
//    */
//   async updateCandle(
//     symbol: string,
//     interval: string,
//     tradePrice: string,
//     tradeVolume: string,
//     tradeTime: number,
//   ): Promise<CandleData> {
//     const key = this.getCandleKey(symbol, interval);
//     const existing = await this.getCandle(symbol, interval);

//     let candle: CandleData;
//     const bucketStart =
//       Math.floor(tradeTime / this.getIntervalMs(interval)) *
//       this.getIntervalMs(interval);
//     const bucketEnd = bucketStart + this.getIntervalMs(interval);

//     if (!existing || existing.endTime <= tradeTime) {
//       // bắt đầu cây nến mới
//       candle = {
//         symbol,
//         interval,
//         o: tradePrice,
//         h: tradePrice,
//         l: tradePrice,
//         c: tradePrice,
//         volume: tradeVolume,
//         startTime: bucketStart + 7 * 60 * 60 * 1000,
//         endTime: bucketEnd + 7 * 60 * 60 * 1000,
//         tradeCount: 0,
//         isClosed: false,
//       };
//     } else {
//       candle = existing;
//       candle.h = Decimal.max(candle.h, tradePrice).toString();
//       candle.l = Decimal.min(candle.l, tradePrice).toString();
//       candle.c = tradePrice;
//       candle.volume = new Decimal(candle.volume).plus(tradeVolume).toString();
//       candle.tradeCount += 1;
//     }

//     // Lưu lại Redis
//     await this.redis.set(key, JSON.stringify(candle));

//     // Publish cho WS (Realtime)
//     await this.publish(
//       this.getCandleChannel(symbol, interval),
//       JSON.stringify(candle),
//     );

//     return candle;
//   }

//   /**
//    * Đánh dấu candle đã kết thúc, emit lần cuối với isClosed=true
//    */
//   async closeCandle(symbol: string, interval: string): Promise<void> {
//     const key = this.getCandleKey(symbol, interval);
//     const candle: Partial<CandleData> | null = await this.getCandle(
//       symbol,
//       interval,
//     );

//     if (candle) candle.isClosed = true;

//     // Emit cho FE trước
//     await this.publish(
//       this.getCandleChannel(symbol, interval),
//       JSON.stringify(candle),
//     );

//     await this.redis.del(key);
//   }

//   /**
//    * Chuyển interval string ("1m", "5m") -> milliseconds
//    */
//   private getIntervalMs(interval: string): number {
//     const num = parseInt(interval);
//     if (interval.endsWith('m')) return num * 60 * 1000;
//     if (interval.endsWith('h')) return num * 60 * 60 * 1000;
//     return 60 * 1000; // default 1m
//   }

//   /**
//    * ticker: todolist
//    * 1. setup path
//    * 2. crud ticker
//    */
//   private getTickerKey(symbol: string) {
//     return `ticker:${symbol}:current`;
//   }

//   private getTickerChannel(symbol: string) {
//     return `channel:ticker:${symbol}`;
//   }

//   async getTicker(symbol: string): Promise<tickerRedis | null> {
//     const tickerKey = this.getTickerKey(symbol);
//     const tickerJson = await this.redis.get(tickerKey);
//     return tickerJson ? (JSON.parse(tickerJson) as tickerRedis) : null;
//   }

//   async getAllTicker(): Promise<sumaryTicker[]> {
//     const symbols = await this.redis.smembers('tickers');
//     const tickers: sumaryTicker[] = [];
//     for (const symbol of symbols) {
//       const ticker = await this.getTicker(symbol);
//       if (!ticker) continue;
//       const tickerSumary: sumaryTicker = {
//         symbol: ticker.symbol,
//         lastPrice: ticker.lastPrice,
//         change24h: ticker.priceChangePercent,
//         updatedAt: ticker.updatedAt,
//       };

//       tickers.push(tickerSumary);
//     }

//     return tickers;
//   }

//   async updateTicker(ticker: tickerRedis) {
//     const key = this.getTickerKey(ticker.symbol);
//     const tickerJson = JSON.stringify(ticker);
//     await this.redis.set(key, tickerJson);
//     await this.redis.sadd('tickers', ticker.symbol);

//     await this.publish(this.getTickerChannel(ticker.symbol), tickerJson);
//   }

//   async deleteTicker(symbol: string) {
//     await this.redis.del(this.getTickerKey(symbol));
//   }
// }
