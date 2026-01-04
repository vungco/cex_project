import { Injectable } from '@nestjs/common';
import { RedisBaseService } from './redis.base.service';
import { CandleData } from 'src/shared/constans';
import Decimal from 'decimal.js';

@Injectable()
export class RedisCandleService {
  constructor(private readonly redisBase: RedisBaseService) {}

  private get redis() {
    return this.redisBase.redis;
  }
  private get publisher() {
    return this.redisBase.publisher;
  }

  private getCandleKey(symbol: string, interval: string) {
    return `candle:${symbol}:${interval}:current`;
  }

  private getCandleChannel(symbol: string, interval: string) {
    return `channel:candle:${symbol}:${interval}`;
  }

  async getCandle(
    symbol: string,
    interval: string,
  ): Promise<CandleData | null> {
    const data = await this.redis.get(this.getCandleKey(symbol, interval));
    return data ? JSON.parse(data) : null;
  }

  async updateCandle(
    symbol: string,
    interval: string,
    tradePrice: string,
    tradeVolume: string,
    tradeTime: number,
  ) {
    const key = this.getCandleKey(symbol, interval);
    const existing = await this.getCandle(symbol, interval);

    const bucketStart =
      Math.floor(tradeTime / this.getIntervalMs(interval)) *
      this.getIntervalMs(interval);
    const bucketEnd = bucketStart + this.getIntervalMs(interval);

    let candle: CandleData;
    if (!existing || existing.endTime <= tradeTime) {
      candle = {
        symbol,
        interval,
        o: tradePrice,
        h: tradePrice,
        l: tradePrice,
        c: tradePrice,
        volume: tradeVolume,
        startTime: bucketStart + 7 * 3600 * 1000,
        endTime: bucketEnd + 7 * 3600 * 1000,
        tradeCount: 1,
        isClosed: false,
      };
    } else {
      candle = existing;
      candle.h = Decimal.max(candle.h, tradePrice).toString();
      candle.l = Decimal.min(candle.l, tradePrice).toString();
      candle.c = tradePrice;
      candle.volume = new Decimal(candle.volume).add(tradeVolume).toString();
      candle.tradeCount += 1;
    }

    await this.redis.set(key, JSON.stringify(candle));
    await this.publisher.publish(
      this.getCandleChannel(symbol, interval),
      JSON.stringify(candle),
    );

    return candle;
  }

  private getIntervalMs(interval: string) {
    const num = parseInt(interval);
    if (interval.endsWith('m')) return num * 60 * 1000;
    if (interval.endsWith('h')) return num * 3600 * 1000;
    return 60 * 1000;
  }

  async closeCandle(symbol: string, interval: string): Promise<void> {
    const key = this.getCandleKey(symbol, interval);
    const candle: Partial<CandleData> | null = await this.getCandle(
      symbol,
      interval,
    );

    if (candle) candle.isClosed = true;

    // Emit cho FE trước
    await this.publisher.publish(
      this.getCandleChannel(symbol, interval),
      JSON.stringify(candle),
    );

    await this.redis.del(key);
  }
}
