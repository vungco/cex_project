import { Injectable, NotFoundException } from '@nestjs/common';
import { Candle1mRepository } from '../repositories';
import { MarketTokenService } from './market-token.service';
import { Candle1mEntity } from '../entities';

@Injectable()
export class Candle1mService {
  constructor(
    private readonly candleRepo1m: Candle1mRepository,
    private readonly marketTokenService: MarketTokenService,
  ) {}

  async findAllBySymbol(symbol: string): Promise<Candle1mEntity[]> {
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
