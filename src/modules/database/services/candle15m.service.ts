import { Injectable, NotFoundException } from '@nestjs/common';
import { MarketTokenService } from './market-token.service';
import { Candle15mEntity } from '../entities';
import { Candle15mRepository } from '../repositories/candle15m.repository';

@Injectable()
export class Candle15mService {
  constructor(
    private readonly candleRepo1m: Candle15mRepository,
    private readonly marketTokenService: MarketTokenService,
  ) {}

  async findAllBySymbol(symbol: string): Promise<Candle15mEntity[]> {
    const market_token = await this.marketTokenService.findByName(symbol);
    const candles = await this.candleRepo1m.find({
      where: { market_token: { id: market_token.id } },
      order: { start_time: 'ASC' },
    });
    if (!candles) {
      throw new NotFoundException('candles not found');
    }
    return candles;
  }
}
