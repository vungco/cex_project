import { Injectable } from '@nestjs/common';
import { TradeEntity } from '../entities/trade.entity';
import { DataSource, Repository } from 'typeorm';

@Injectable()
export class TradeRepository extends Repository<TradeEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(TradeEntity, dataSource.createEntityManager());
  }
}
