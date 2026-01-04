import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Candle15mEntity } from '../entities';

@Injectable()
export class Candle15mRepository extends Repository<Candle15mEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(Candle15mEntity, dataSource.createEntityManager());
  }
}
