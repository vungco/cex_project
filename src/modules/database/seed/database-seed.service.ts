import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TokenEntity } from '../entities/token.entity';
import { SEED_TOKENS } from './cex-seed.constants';

@Injectable()
export class DatabaseSeedService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseSeedService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onModuleInit() {
    await this.seedTokens();
  }

  private async seedTokens() {
    const repo = this.dataSource.getRepository(TokenEntity);
    for (const row of SEED_TOKENS) {
      if (await repo.exists({ where: { asset: row.asset } })) {
        continue;
      }
      await repo.save(
        repo.create({
          id: row.id,
          asset: row.asset,
          name: row.name,
          is_native: row.is_native,
        }),
      );
      this.logger.log(`seed tokens: inserted ${row.asset} (${row.id})`);
    }
  }
}
