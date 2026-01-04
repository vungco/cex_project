import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { LedgerEntity } from '../entities/ledger.entity';

@Injectable()
export class LedgerRepository extends Repository<LedgerEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(LedgerEntity, dataSource.createEntityManager());
  }
}
