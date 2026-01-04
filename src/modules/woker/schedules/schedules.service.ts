import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { Candle1mEntity } from 'src/modules/database/entities/candles/candle_1m.entity';
import { Candle5mEntity } from 'src/modules/database/entities/candles/candle_5m.entity';
import {
  BalanceService,
  MarketTokenService,
} from 'src/modules/database/services';
import { TickerService } from 'src/modules/database/services/ticker.service';
import { TickerRepository } from 'src/modules/database/repositories';
import { Candle15mEntity } from 'src/modules/database/entities';
import Decimal from 'decimal.js';
import { UserDailyPnlService } from 'src/modules/database/services/user-daily-pnl.service';
import dayjs from 'dayjs';
import { RedisBaseService } from 'src/modules/redis/services/redis.base.service';
import { RedisCandleService } from 'src/modules/redis/services/redis.candle.service';
import { RedisTickerService } from 'src/modules/redis/services/redis.ticker.service';

@Injectable()
export class SpotSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SpotSchedulerService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly marketTokenService: MarketTokenService,
    private readonly redisService: RedisBaseService,
    private readonly redisCandleService: RedisCandleService,
    private readonly redisTickerService: RedisTickerService,
    private readonly tickerService: TickerService,
    private readonly tickerRepo: TickerRepository,
    private readonly balanceService: BalanceService,
    private readonly user_daulyService: UserDailyPnlService,
  ) {}

  onModuleInit() {
    this.logger.warn('SpotSchedulerService initialized');
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handle1mCandle() {
    await this.handleCandle('1m');
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handle5mCandle() {
    await this.handleCandle('5m');
  }

  @Cron('*/15 * * * *')
  async handle15mCandle() {
    await this.handleCandle('15m');
  }

  // @Cron('*/10 * * * *')
  @Cron('0 0 * * *')
  async handleDailyTickerUpdate() {
    console.log('🌙 run ticker job while 0h00');
    const marketTokens = await this.marketTokenService.getAll();

    for (const mt of marketTokens) {
      try {
        const ticker_old = await this.redisTickerService.getTicker(mt.symbol);
        ticker_old['market_token'] = mt;
        await this.tickerService.createTicker(
          this.tickerRepo.create(ticker_old),
        );

        //user pnl
        const balanceBaseAssetForUsers =
          await this.balanceService.getAllBalanceByAsset(mt.baseToken);
        for (const balance of balanceBaseAssetForUsers) {
          const unrealized_pnl = new Decimal(ticker_old.lastPrice)
            .minus(ticker_old.openPrice)
            .times(new Decimal(balance.available).plus(balance.locked))
            .toString();
          await this.user_daulyService.create(
            balance.wallet.user,
            mt,
            unrealized_pnl,
          );
        }

        await this.redisTickerService.updateTicker({
          symbol: mt.symbol,
          openPrice: ticker_old.lastPrice,
          lastPrice: ticker_old.lastPrice,
          highPrice: ticker_old.lastPrice,
          lowPrice: ticker_old.lastPrice,
          baseVolume: '0',
          quoteVolume: '0',
          priceChangePercent: '0',
          updatedAt: dayjs().toDate(),
        });
      } catch (error) {
        console.error(`❌ Error with ${mt.symbol}:`, error.message);
      }
    }
  }

  /**
   * Tự động chọn repository phù hợp theo interval
   */
  private getCandleRepository(interval: string) {
    switch (interval) {
      case '1m':
        return this.dataSource.getRepository(Candle1mEntity);
      case '5m':
        return this.dataSource.getRepository(Candle5mEntity);
      case '15m':
        return this.dataSource.getRepository(Candle15mEntity);
      default:
        throw new Error(`Unsupported interval ${interval}m`);
    }
  }

  /**
   * initCandle
   * handleCandle
   */

  async handleCandle(interval: string) {
    const redis = this.redisService;

    const market_tokens = await this.marketTokenService.getAll();
    const candleRepo = this.getCandleRepository(interval);

    for (const marketToken of market_tokens) {
      if (!marketToken.isActive) continue;
      const symbol = marketToken.symbol;
      const candleRedis = await this.redisCandleService.getCandle(
        symbol,
        interval,
      );
      if (!candleRedis) {
        this.logger.warn(`candleRedis of ${marketToken.symbol} not found`);
        this.marketTokenService.initCandle(marketToken, '0');
        continue;
      }
      const market_token = await this.marketTokenService.findByName(symbol);

      // 1. final candle old
      await Promise.all([
        this.redisCandleService.closeCandle(symbol, interval),
        candleRepo.upsert(
          candleRepo.create({
            start_time: candleRedis.startTime,
            end_time: candleRedis.endTime,
            market_token: market_token,
            o: candleRedis.o,
            h: candleRedis.h,
            l: candleRedis.l,
            c: candleRedis.c,
            volume: candleRedis.volume,
            trades_count: candleRedis.tradeCount,
          }),
          ['market_token', 'start_time'],
        ),
      ]);

      // 2. create candle new
      await this.redisCandleService.updateCandle(
        symbol,
        interval,
        candleRedis.c,
        '0',
        dayjs().valueOf(),
      );
    }
  }
}
