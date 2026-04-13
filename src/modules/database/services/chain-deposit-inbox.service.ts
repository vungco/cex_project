import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

@Injectable()
export class ChainDepositInboxService {
  /**
   * Inserts idempotency row; returns true only for the first successful insert.
   */
  async tryClaim(
    manager: EntityManager,
    idempotencyKey: string,
  ): Promise<boolean> {
    const rows: unknown[] = await manager.query(
      `
      INSERT INTO chain_deposit_inbox (id, idempotency_key, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, NOW(), NOW())
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id
      `,
      [idempotencyKey],
    );
    return Array.isArray(rows) && rows.length > 0;
  }
}
