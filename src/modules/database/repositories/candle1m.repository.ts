import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Candle1mEntity } from '../entities';

@Injectable()
export class Candle1mRepository extends Repository<Candle1mEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(Candle1mEntity, dataSource.createEntityManager());
  }
}
