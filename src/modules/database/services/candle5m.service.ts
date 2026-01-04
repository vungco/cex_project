import { Injectable, NotFoundException } from '@nestjs/common';
import { MarketTokenService } from './market-token.service';
import { Candle5mEntity } from '../entities';
import { Candle5mRepository } from '../repositories/candle5m.repository';

@Injectable()
export class Candle5mService {
  constructor(
    private readonly candleRepo1m: Candle5mRepository,
    private readonly marketTokenService: MarketTokenService,
  ) {}

  async findAllBySymbol(symbol: string): Promise<Candle5mEntity[]> {
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
