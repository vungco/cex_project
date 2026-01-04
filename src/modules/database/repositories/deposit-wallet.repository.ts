import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DepositWalletEntity } from '../entities/deposit-wallet.entity';

@Injectable()
export class DepositWalletRepository extends Repository<DepositWalletEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(DepositWalletEntity, dataSource.createEntityManager());
  }
}
