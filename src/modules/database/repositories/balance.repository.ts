import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { BalanceEntity } from '../entities/balance.entity';

@Injectable()
export class BalanceRepository extends Repository<BalanceEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(BalanceEntity, dataSource.createEntityManager());
  }
}
