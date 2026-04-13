import { Injectable, Logger } from '@nestjs/common';
import EventEmitter2 from 'eventemitter2';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  TransactionStatus,
  TransactionType,
} from 'src/modules/database/entities/transaction-history.entity';
import { BalanceService, TokenService } from 'src/modules/database/services';
import { DepositWalletService } from 'src/modules/database/services/deposit-wallet.service';
import {
  EmitResponHistoryDto,
  TransactionHistoryService,
} from 'src/modules/database/services/transaction-history.service';
import { DepositEvent } from 'src/shared/enums/enum';
import { ChainDepositInboxService } from 'src/modules/database/services/chain-deposit-inbox.service';

type DepositPayload = {
  idempotency_key?: string;
  user_id?: string;
  token_id?: string | null;
  network_id?: string;
  excu_address?: string;
  txHash?: string;
  value?: string;
  network_name?: string;
  fee?: string;
  deposit_kind?: 'NATIVE' | 'ERC20';
  log_index?: number | null;
};

function parsePayload(raw: unknown): DepositPayload {
  if (raw == null) throw new Error('empty payload');
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    obj = JSON.parse(raw);
  } else if (Buffer.isBuffer(raw)) {
    obj = JSON.parse(raw.toString('utf8'));
  }
  // Do not JSON.parse(obj.value) for deposit payloads: `value` is the amount string
  // (JSON.parse("0.1") → number → invalid). Only unwrap when value is a JSON object string.
  if (typeof obj === 'object' && obj !== null && 'value' in obj) {
    const v = (obj as { value?: unknown }).value;
    if (typeof v === 'string' && /^\s*\{/.test(v)) {
      try {
        obj = JSON.parse(v);
      } catch {
        // keep outer object
      }
    }
  }
  if (typeof obj !== 'object' || obj === null) {
    throw new Error('invalid payload shape');
  }
  return obj as DepositPayload;
}

function describeRawType(raw: unknown): string {
  if (raw == null) return String(raw);
  if (Buffer.isBuffer(raw)) return `Buffer(len=${raw.length})`;
  if (typeof raw === 'string') return `string(len=${raw.length})`;
  if (typeof raw === 'object') {
    const keys = Object.keys(raw as object).slice(0, 8).join(',');
    return `object(keys=${keys || 'empty'})`;
  }
  return typeof raw;
}

function shortHex(h: string, keep = 10): string {
  if (!h || h.length <= keep + 2) return h;
  return `${h.slice(0, keep)}…`;
}

@Injectable()
export class WalletDepositKafkaHandler {
  private readonly logger = new Logger(WalletDepositKafkaHandler.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly chainDepositInbox: ChainDepositInboxService,
    private readonly depositWalletService: DepositWalletService,
    private readonly transactionHistoryService: TransactionHistoryService,
    private readonly tokenService: TokenService,
    private readonly balanceService: BalanceService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async handle(rawMessage: unknown): Promise<void> {
    this.logger.log(
      `deposit kafka in: rawType=${describeRawType(rawMessage)}`,
    );

    const p = parsePayload(rawMessage);
    const idempotencyKey = p.idempotency_key?.trim();
    if (!idempotencyKey) throw new Error('missing idempotency_key');

    const user_id = p.user_id;
    const value = p.value;
    const network_id = p.network_id;
    const excu_address = p.excu_address;
    const txHash = p.txHash;
    const fee = p.fee ?? '0';

    if (!user_id || !value || !network_id || !txHash) {
      throw new Error('missing required deposit fields');
    }

    this.logger.log(
      `deposit parsed: idempotencyKey=${idempotencyKey} kind=${p.deposit_kind ?? '?'} ` +
        `user_id=${user_id} network_id=${network_id} network_name=${p.network_name ?? '-'} ` +
        `payload_token_id=${p.token_id ?? 'null'} value=${value} tx=${shortHex(txHash)} ` +
        `to=${excu_address ?? '-'}`,
    );

    const resolvedTokenId = await this.resolveTokenId(p);
    this.logger.log(
      `deposit resolved token_id=${resolvedTokenId} (native uses network_name → findByAsset)`,
    );

    const historyForEmit = await this.dataSource.transaction(
      async (manager) => {
        this.logger.log(
          `deposit tx begin: idempotencyKey=${idempotencyKey}`,
        );

        const claimed = await this.chainDepositInbox.tryClaim(
          manager,
          idempotencyKey,
        );
        if (!claimed) {
          this.logger.log(
            `deposit skip duplicate (inbox already claimed): ${idempotencyKey}`,
          );
          return null;
        }

        this.logger.log(`deposit inbox claimed (new): ${idempotencyKey}`);

        const deposit = await this.depositWalletService.getDepositWithManager(
          manager,
          user_id,
          resolvedTokenId,
        );
        this.logger.log(
          `deposit wallet row: depositWalletId=${deposit.id} walletId=${deposit.wallet.id}`,
        );

        const token = await this.tokenService.findById(resolvedTokenId);
        this.logger.log(
          `deposit token: asset=${token.asset} name=${token.name}`,
        );

        await this.balanceService.depositTokenWithManager(
          manager,
          deposit.wallet,
          resolvedTokenId,
          value,
          user_id,
        );
        this.logger.log(
          `deposit balance+ledger applied: amount=${value} user_id=${user_id}`,
        );

        const depositHistory: EmitResponHistoryDto = {
          user: deposit.wallet.user,
          token,
          networkId: network_id,
          amount: value,
          excuAddress: excu_address ?? '',
          txHash,
          status: TransactionStatus.CONFIRMED,
          type: TransactionType.DEPOSIT,
          fee,
        };

        await this.transactionHistoryService.createWithManager(
          manager,
          depositHistory,
        );
        this.logger.log(
          `deposit tx_history saved: tx=${shortHex(txHash)} networkId=${network_id}`,
        );

        return depositHistory;
      },
    );

    if (historyForEmit) {
      this.logger.log(
        `deposit emit ${DepositEvent.CREATE}: user=${historyForEmit.user.id} amount=${historyForEmit.amount}`,
      );
      this.eventEmitter.emit(DepositEvent.CREATE, historyForEmit);
    } else {
      this.logger.log(
        `deposit done without emit (duplicate or no-op): ${idempotencyKey}`,
      );
    }
  }

  private async resolveTokenId(p: DepositPayload): Promise<string> {
    if (p.token_id) {
      this.logger.log(`resolveTokenId: using payload token_id=${p.token_id}`);
      return p.token_id;
    }
    const asset = p.network_name;
    if (!asset) throw new Error('native deposit missing network_name');
    this.logger.log(
      `resolveTokenId: native path findByAsset("${asset}") from network_name`,
    );
    const t = await this.tokenService.findByAsset(asset);
    return t.id;
  }
}
