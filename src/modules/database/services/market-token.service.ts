import { Injectable, NotFoundException } from '@nestjs/common';
import { MarketTokenRepository } from '../repositories/market-token.repository';
import { MarketTokenEntity } from '../entities/market-token.entity';
import { MarketTokenCreateDto } from 'src/modules/api/dtos';
import { TokenService } from './token.service';
import dayjs from 'dayjs';
import { timeFrameCandles } from 'src/shared/constans';
import EventEmitter2 from 'eventemitter2';
import { MarketEvent } from 'src/shared/enums/enum';
import { UserEntity } from '../entities';
import { UserRepository } from '../repositories';
import { RedisBaseService } from 'src/modules/redis/services/redis.base.service';
import { RedisCandleService } from 'src/modules/redis/services/redis.candle.service';
import { RedisTickerService } from 'src/modules/redis/services/redis.ticker.service';

@Injectable()
export class MarketTokenService {
  constructor(
    private readonly marketTokenRepository: MarketTokenRepository,
    private readonly tokenService: TokenService,
    private readonly redisService: RedisBaseService,
    private readonly eventEmitter: EventEmitter2,
    private readonly userRepo: UserRepository,
    private readonly redisCandleService: RedisCandleService,
    private readonly redisTickerService: RedisTickerService,
  ) {}

  async findByName(symbol: string): Promise<MarketTokenEntity> {
    const market_token = await this.marketTokenRepository.findOne({
      where: { symbol },
      relations: ['baseToken', 'quoteToken'],
    });
    if (!market_token) {
      throw new Error('Market token not found');
    }
    return market_token;
  }

  async findById(id: string): Promise<MarketTokenEntity> {
    const market_token = await this.marketTokenRepository.findOne({
      where: { id },
      relations: ['baseToken', 'quoteToken'],
    });
    if (!market_token) {
      throw new Error('Market token not found');
    }
    return market_token;
  }

  async create(
    body: MarketTokenCreateDto,
  ): Promise<{ success: boolean; marketToken: MarketTokenEntity }> {
    const { baseAsset, quoteAsset } = body;
    const [baseToken, quoteToken] = await Promise.all([
      this.tokenService.findByAsset(baseAsset),
      this.tokenService.findByAsset(quoteAsset),
    ]);
    const symbol = `${baseToken?.asset}${quoteToken?.asset}`;
    const existingMarketToken = await this.marketTokenRepository.findOne({
      where: { symbol },
    });
    if (existingMarketToken) {
      throw new Error('Market token already exists');
    }

    const newMarketToken = await this.marketTokenRepository.save(
      this.marketTokenRepository.create({
        baseToken,
        quoteToken,
        symbol,
      }),
    );

    if (!newMarketToken) {
      throw new Error('Market token creation failed');
    }

    this.eventEmitter.emit(MarketEvent.CREATE, newMarketToken.symbol);
    return { success: true, marketToken: newMarketToken };
  }

  async handleActiveMarketToken(
    symbol: string,
    active: string,
    initPrice?: string,
  ): Promise<any> {
    if (active === 'true' && initPrice) {
      const mk = await this.marketTokenRepository.findOne({
        where: { symbol },
      });
      if (!mk) {
        throw new NotFoundException(`${symbol} not found`);
      }
      mk.isActive = true;
      await this.marketTokenRepository.save(mk);
      this.initCandle(mk, initPrice);
      this.redisTickerService.updateTicker({
        symbol: mk.symbol,
        baseVolume: '0',
        highPrice: '0',
        lastPrice: initPrice,
        lowPrice: '0',
        openPrice: initPrice,
        priceChangePercent: '0',
        quoteVolume: '0',
        updatedAt: dayjs().toDate(),
      });
      this.eventEmitter.emit(MarketEvent.ACTIVE, symbol);

      return { status: 'successfull' };
    } else {
      this.eventEmitter.emit(MarketEvent.INACTIVE, symbol);
      return { status: 'successfull inactive' };
    }
  }

  async getAll(): Promise<MarketTokenEntity[]> {
    const market_tokens = await this.marketTokenRepository.find();
    if (!market_tokens) {
      throw new NotFoundException('not found market_token');
    }
    return market_tokens;
  }

  async initCandle(market_token: MarketTokenEntity, initPrice: string) {
    const redis = this.redisService;

    const tradeTime = dayjs().valueOf();

    for (const interval of timeFrameCandles) {
      const existCandle = await this.redisCandleService.getCandle(
        market_token.symbol,
        interval,
      );
      if (existCandle) return;

      // 2. create candle new
      this.redisCandleService.updateCandle(
        market_token.symbol,
        interval,
        initPrice,
        '0',
        tradeTime,
      );
    }

    console.log('inital candles');
  }

  async getUserAndMarketToken(
    user_id: string,
    symbol: string,
  ): Promise<[UserEntity, MarketTokenEntity]> {
    return await Promise.all([
      this.userRepo.findById(user_id),
      this.findByName(symbol),
    ]);
  }
}
