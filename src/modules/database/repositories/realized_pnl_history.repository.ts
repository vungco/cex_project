import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { RealizedPnlEntity } from '../entities/realized_pnl_history';

@Injectable()
export class Realized_pnl_historyRepository extends Repository<RealizedPnlEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(RealizedPnlEntity, dataSource.createEntityManager());
  }
}
