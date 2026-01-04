import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { TransactionHistoryEntity } from '../entities/transaction-history.entity';

@Injectable()
export class TransactionHistoryReposirory extends Repository<TransactionHistoryEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(TransactionHistoryEntity, dataSource.createEntityManager());
  }
}
