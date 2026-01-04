import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { User_daily_pnlEntity } from '../entities/user-daily-pnl.entity';

@Injectable()
export class UserDailyPnlRepository extends Repository<User_daily_pnlEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(User_daily_pnlEntity, dataSource.createEntityManager());
  }
}
