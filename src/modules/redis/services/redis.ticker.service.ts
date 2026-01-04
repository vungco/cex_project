import { Injectable } from '@nestjs/common';
import { RedisBaseService } from './redis.base.service';
import { tickerRedis } from 'src/shared/constans';
import { sumaryTicker } from '../constans/redis';
import { InjectRepository } from '@nestjs/typeorm';
import { TickerEntity } from 'src/modules/database/entities';
import { Repository } from 'typeorm';
import { MarketTokenEntity } from 'src/modules/database/entities/market-token.entity';

@Injectable()
export class RedisTickerService {
  constructor(
    private readonly redisBase: RedisBaseService,
    @InjectRepository(TickerEntity)
    private readonly tickerRepo: Repository<TickerEntity>,
    @InjectRepository(MarketTokenEntity)
    private readonly marketTokenRepo: Repository<MarketTokenEntity>,
  ) {}

  private get redis() {
    return this.redisBase.redis;
  }
  private get publisher() {
    return this.redisBase.publisher;
  }

  private getTickerKey(symbol: string) {
    return `ticker:${symbol}:current`;
  }
  private getTickerChannel(symbol: string) {
    return `channel:ticker:${symbol}`;
  }

  async updateTicker(ticker: tickerRedis) {
    const json = JSON.stringify(ticker);
    await this.redis.set(this.getTickerKey(ticker.symbol), json);
    await this.redis.sadd('tickers', ticker.symbol);
    await this.publisher.publish(this.getTickerChannel(ticker.symbol), json);
  }

  async getTicker(symbol: string): Promise<tickerRedis> {
    try {
      const key = this.getTickerKey(symbol);
      const data = await this.redis.get(key);
      if (data) return JSON.parse(data);

      console.warn(`Ticker ${symbol} not found in Redis. Trying DB...`);

      const tickerDb = await this.tickerRepo
        .createQueryBuilder('ticker')
        .innerJoinAndSelect('ticker.market_token', 'mt')
        .where('mt.symbol = :symbol', { symbol })
        .andWhere('DATE(ticker.createdAt) = CURRENT_DATE')
        .orderBy('ticker.createdAt', 'DESC')
        .getOne();

      if (tickerDb) {
        const ticker: tickerRedis = {
          symbol,
          lastPrice: tickerDb.lastPrice,
          priceChangePercent: tickerDb.priceChangePercent,
          highPrice: tickerDb.highPrice,
          lowPrice: tickerDb.lowPrice,
          baseVolume: tickerDb.baseVolume,
          quoteVolume: tickerDb.quoteVolume,
          updatedAt: tickerDb.updatedAt,
          openPrice: tickerDb.openPrice,
        };

        await this.redis.set(key, JSON.stringify(ticker));
        return ticker;
      }

      const defaultTicker: tickerRedis = {
        symbol,
        lastPrice: '0.2',
        priceChangePercent: '0',
        highPrice: '0.2',
        lowPrice: '0.2',
        baseVolume: '0',
        quoteVolume: '0',
        updatedAt: new Date(),
        openPrice: '0.2',
      };

      // Optionally lưu vào DB để lần sau có luôn
      const marketToken = await this.marketTokenRepo.findOne({
        where: { symbol },
      });
      if (marketToken) {
        await this.tickerRepo.save(
          this.tickerRepo.create({
            market_token: marketToken,
            lastPrice: defaultTicker.lastPrice,
            priceChangePercent: defaultTicker.priceChangePercent,
            highPrice: defaultTicker.highPrice,
            lowPrice: defaultTicker.lowPrice,
            baseVolume: defaultTicker.baseVolume,
            quoteVolume: defaultTicker.quoteVolume,
          }),
        );
      }

      // Set vào Redis
      await this.redis.set(key, JSON.stringify(defaultTicker));

      return defaultTicker;
    } catch (error) {
      throw new Error(`Failed to get ticker for ${symbol}:`);
    }
  }

  async getAllTicker(): Promise<sumaryTicker[]> {
    const symbols = await this.redis.smembers('tickers');
    const tickers: sumaryTicker[] = [];
    for (const s of symbols) {
      const t = await this.getTicker(s);
      if (!t) continue;
      tickers.push({
        symbol: t.symbol,
        lastPrice: t.lastPrice,
        change24h: t.priceChangePercent,
        updatedAt: t.updatedAt,
      });
    }
    return tickers;
  }
}
