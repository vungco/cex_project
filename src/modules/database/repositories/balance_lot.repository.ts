import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { BalanceLotEntity } from '../entities';

@Injectable()
export class BalanceLotRepository extends Repository<BalanceLotEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(BalanceLotEntity, dataSource.createEntityManager());
  }
}
