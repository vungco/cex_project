import { Module } from '@nestjs/common';
import { RedisBaseService } from './services/redis.base.service';
import { RedisOrderBookService } from './services/redis.orderbook.service';
import { RedisCandleService } from './services/redis.candle.service';
import { RedisTickerService } from './services/redis.ticker.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TickerEntity } from '../database/entities';
import { MarketTokenEntity } from '../database/entities/market-token.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TickerEntity, MarketTokenEntity])],
  controllers: [],
  providers: [
    RedisBaseService,
    RedisOrderBookService,
    RedisCandleService,
    RedisTickerService,
  ],
  exports: [
    RedisBaseService,
    RedisOrderBookService,
    RedisCandleService,
    RedisTickerService,
  ],
})
export class RedisModule {}
