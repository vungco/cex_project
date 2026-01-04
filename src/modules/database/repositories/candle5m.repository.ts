import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Candle5mEntity } from '../entities';

@Injectable()
export class Candle5mRepository extends Repository<Candle5mEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(Candle5mEntity, dataSource.createEntityManager());
  }
}
