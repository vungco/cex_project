import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { TickerEntity } from '../entities';

@Injectable()
export class TickerRepository extends Repository<TickerEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(TickerEntity, dataSource.createEntityManager());
  }
}
