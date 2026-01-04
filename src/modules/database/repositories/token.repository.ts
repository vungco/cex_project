import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { TokenEntity } from '../entities/token.entity';

@Injectable()
export class TokenRepository extends Repository<TokenEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(TokenEntity, dataSource.createEntityManager());
  }
}
