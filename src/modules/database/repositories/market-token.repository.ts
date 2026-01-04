import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { MarketTokenEntity } from '../entities/market-token.entity';

@Injectable()
export class MarketTokenRepository extends Repository<MarketTokenEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(MarketTokenEntity, dataSource.createEntityManager());
  }
}
