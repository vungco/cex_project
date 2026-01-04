import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { WalletEntity } from '../entities/wallet.entity';

@Injectable()
export class WalletRepository extends Repository<WalletEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(WalletEntity, dataSource.createEntityManager());
  }
}
