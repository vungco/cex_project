import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { UserDailyPnlRepository } from '../repositories/user-daily-pnl.repository';
import { User_daily_pnlEntity } from '../entities/user-daily-pnl.entity';
import { MarketTokenEntity } from '../entities/market-token.entity';
import { UserEntity } from '../entities';

@Injectable()
export class UserDailyPnlService {
  constructor(private readonly user_daily_pnlRepo: UserDailyPnlRepository) {}

  async create(
    user: UserEntity,
    market_token: MarketTokenEntity,
    unrealized_pnl: string,
  ): Promise<User_daily_pnlEntity> {
    const save = await this.user_daily_pnlRepo.save(
      this.user_daily_pnlRepo.create({ market_token, unrealized_pnl }),
    );
    if (!save) {
      throw new InternalServerErrorException('error save udPnl');
    }
    return save;
  }
}
