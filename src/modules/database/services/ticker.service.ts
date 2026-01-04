import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { TickerEntity } from '../entities';
import { TickerRepository } from '../repositories';
import dayjs from 'dayjs';
import EventEmitter2 from 'eventemitter2';
import { SpotEvent } from 'src/shared/enums/enum';
import { sumaryTicker } from 'src/modules/redis/constans/redis';
import { tickerRedis } from 'src/shared/constans';
import { RedisBaseService } from 'src/modules/redis/services/redis.base.service';
import { RedisTickerService } from 'src/modules/redis/services/redis.ticker.service';

@Injectable()
export class TickerService implements OnModuleInit {
  private tickerSumarys = new Map<string, sumaryTicker>();

  constructor(
    private readonly tickerRepo: TickerRepository,
    private readonly redisService: RedisBaseService,
    private readonly eventEmitter: EventEmitter2,
    private readonly redisTickerService: RedisTickerService,
  ) {
    setInterval(() => this.flushChangedTickers(), 6000);
  }

  async onModuleInit(): Promise<void> {
    const tickers = await this.getAllTickerCurrent();
    if (tickers.length === 0) {
      return;
    }
    for (const ticker of tickers) {
      this.tickerSumarys.set(ticker.symbol, ticker);
    }
  }

  async createTicker(ticker: TickerEntity): Promise<TickerEntity> {
    const tickerSave = await this.tickerRepo.save(ticker);

    if (!tickerSave) {
      throw new InternalServerErrorException('save fail');
    }
    return tickerSave;
  }

  async findOne(): Promise<TickerEntity> {
    const tickerNewest = await this.tickerRepo.findOne({
      order: { createdAt: 'DESC' },
    });

    if (!tickerNewest) {
      throw new NotFoundException('ticker newest not found');
    }
    return tickerNewest;
  }

  async getAllTickerCurrent(): Promise<sumaryTicker[]> {
    return await this.redisTickerService.getAllTicker();
  }

  private async flushChangedTickers() {
    const batch: Record<string, sumaryTicker> = {};

    for (const [symbol, ticker] of this.tickerSumarys.entries()) {
      const last = await this.redisTickerService.getTicker(symbol);

      if (last) {
        if (dayjs(last.updatedAt).isAfter(ticker.updatedAt)) {
          const sumaryTicker = this.convertToTickerSumary(last);
          batch[symbol] = sumaryTicker;
          this.tickerSumarys.set(symbol, sumaryTicker);
        }
      }
    }

    if (Object.keys(batch).length > 0) {
      this.eventEmitter.emit(SpotEvent.TickerBatch, batch);
    }
  }

  convertToTickerSumary(ticker: tickerRedis) {
    const sumary: sumaryTicker = {
      symbol: ticker.symbol,
      lastPrice: ticker.lastPrice,
      change24h: ticker.priceChangePercent,
      updatedAt: ticker.updatedAt,
    };

    return sumary;
  }
}
