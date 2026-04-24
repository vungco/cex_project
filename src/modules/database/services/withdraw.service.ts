import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import {
  CaculatorFeeDto,
  CreateWithdrawDto,
} from 'src/modules/api/dtos/withdraw.dto';
import { firstValueFrom } from 'rxjs';
import { TokenService } from './token.service';
import {
  BalanceEntity,
  BalanceLotEntity,
  descriptionType,
  LedgerEntity,
  LedgerReason,
  UserEntity,
  WalletEntity,
  walletType,
} from '../entities';
import {
  TransactionHistoryEntity,
  TransactionStatus,
  TransactionType,
} from '../entities/transaction-history.entity';
import Decimal from 'decimal.js';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { WalletService } from './wallet.service';
import { DEFAULT_ASSET } from 'src/shared/constans';
import { RedisTickerService } from 'src/modules/redis/services/redis.ticker.service';
import { BalanceLotService } from './balance_lot.service';
import EventEmitter2 from 'eventemitter2';
import { WithdrawEvent } from 'src/shared/enums/enum';
import { WithdrawalUpdatedEmitDto } from './transaction-history.service';
import { TokenEntity } from '../entities/token.entity';

@Injectable()
export class WithdrawService {
  private readonly logger = new Logger(WithdrawService.name);

  constructor(
    private readonly tokenService: TokenService,
    private readonly walletService: WalletService,
    private readonly balanceLotService: BalanceLotService,
    private readonly redisTickerService: RedisTickerService,
    @Inject('BLOCKCHAIN_SERVICE')
    private readonly blockchainClient: ClientProxy,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject() private readonly eventEmitter: EventEmitter2,
  ) {}

  async createWithdraw(
    dto: CreateWithdrawDto,
    user: UserEntity,
  ): Promise<{
    withdrawalId: string;
    txHash: string;
    amount: string;
    fee: string;
    tokenId: string;
    networkId: string;
    status: TransactionStatus;
    type: TransactionType;
  }> {
    const { token_id, network_id, to_address, amount } = dto;

    const feeToken: { fee: string; feeMin: string } = await firstValueFrom(
      this.blockchainClient.send('feeTokenWithdraw', {
        token_id,
        network_id,
      }),
    );

    if (new Decimal(amount).lessThan(feeToken.feeMin)) {
      throw new HttpException(
        'Amount must be greater than minimum fee',
        HttpStatus.BAD_REQUEST,
      );
    }

    const token = await this.tokenService.findById(token_id);
    const wallet = await this.walletService.getWallet(
      walletType.FUNDING,
      user,
    );

    if (!token) throw new NotFoundException('Token not found');
    if (!wallet) throw new NotFoundException('Funding wallet not found');

    const withdrawAmount = new Decimal(amount).minus(feeToken.fee).toString();

    const pending = await this.dataSource.transaction(async (manager) => {
      const balanceRepo = manager.getRepository(BalanceEntity);
      const ledgerRepo = manager.getRepository(LedgerEntity);
      const balanceLotRepo = manager.getRepository(BalanceLotEntity);
      const txRepo = manager.getRepository(TransactionHistoryEntity);

      const balance = await balanceRepo.findOne({
        where: { wallet: { id: wallet.id }, token: { id: token.id } },
        lock: { mode: 'pessimistic_write' },
      });
      if (!balance) throw new NotFoundException('Balance not found');

      if (new Decimal(balance.available).lessThan(amount)) {
        throw new HttpException(
          'Insufficient available balance',
          HttpStatus.BAD_REQUEST,
        );
      }

      balance.available = new Decimal(balance.available).minus(amount).toString();
      await balanceRepo.save(balance);

      const ledgerData: Partial<LedgerEntity> = {
        token,
        delta: amount,
        user,
        reason: LedgerReason.WITHDRAW,
        description: descriptionType.SUCCESSFUL,
      };

      if (token.asset !== DEFAULT_ASSET) {
        const ticker = await this.redisTickerService.getTicker(
          `${token.asset}${DEFAULT_ASSET}`,
        );
        ledgerData.priceUsdt = ticker?.lastPrice;
      }

      await ledgerRepo.save(ledgerRepo.create(ledgerData));

      if (token.asset !== DEFAULT_ASSET) {
        await this.balanceLotService.deductBalanceLotsAtomic(
          balanceLotRepo,
          token,
          wallet,
          amount,
        );
      }

      const tx = txRepo.create({
        user,
        networkId: network_id,
        token,
        excuAddress: to_address,
        amount,
        fee: feeToken.fee,
        txHash: null!,
        status: TransactionStatus.PENDING,
        type: TransactionType.WITHDRAWAL,
      });
      return txRepo.save(tx);
    });

    const grossAmount = amount;

    try {
      const result: { txHash: string } = await firstValueFrom(
        this.blockchainClient.send('withdraw', {
          token,
          user_id: user.id,
          network_id,
          to_address,
          amount: withdrawAmount,
          withdrawal_id: pending.id,
        }),
      );

      const updated = await this.dataSource.transaction(async (manager) => {
        const txRepo = manager.getRepository(TransactionHistoryEntity);
        const row = await txRepo.findOne({
          where: { id: pending.id },
          relations: ['token', 'user'],
        });
        if (!row) throw new NotFoundException('Pending withdraw row missing');
        row.txHash = result.txHash;
        row.status = TransactionStatus.BROADCASTED;
        return txRepo.save(row);
      });

      const forEmit = await this.dataSource.getRepository(TransactionHistoryEntity).findOne({
        where: { id: updated.id },
        relations: ['token', 'user'],
      });
      if (forEmit) {
        this.emitPayload({
          user: forEmit.user,
          tx: forEmit,
          networkId: network_id,
          toAddress: to_address,
          explorerUrl: null,
        });
      }

      return {
        withdrawalId: updated.id,
        txHash: updated.txHash,
        amount: updated.amount,
        fee: updated.fee,
        tokenId: token.id,
        networkId: network_id,
        status: updated.status,
        type: updated.type,
      };
    } catch (error) {
      this.logger.warn(
        `Withdraw on-chain failed for pendingTx=${pending.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      await this.compensateAfterChainFailure(
        pending.id,
        user,
        wallet,
        token,
        grossAmount,
      );

      const failed = await this.dataSource
        .getRepository(TransactionHistoryEntity)
        .findOne({ where: { id: pending.id }, relations: ['token', 'user'] });

      if (failed) {
        this.emitPayload({
          user,
          tx: failed,
          networkId: network_id,
          toAddress: to_address,
          explorerUrl: null,
        });
      }

      if (error instanceof RpcException) throw error;
      if (error instanceof HttpException) throw error;

      throw new HttpException(
        (error as { message?: string })?.message || 'Blockchain withdraw failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async compensateAfterChainFailure(
    transactionId: string,
    user: UserEntity,
    wallet: WalletEntity,
    token: TokenEntity,
    grossAmount: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const balanceRepo = manager.getRepository(BalanceEntity);
      const ledgerRepo = manager.getRepository(LedgerEntity);
      const balanceLotRepo = manager.getRepository(BalanceLotEntity);
      const txRepo = manager.getRepository(TransactionHistoryEntity);

      const balance = await balanceRepo.findOne({
        where: { wallet: { id: wallet.id }, token: { id: token.id } },
        lock: { mode: 'pessimistic_write' },
      });
      if (balance) {
        balance.available = new Decimal(balance.available)
          .plus(grossAmount)
          .toString();
        await balanceRepo.save(balance);
      }

      const refundLedger: Partial<LedgerEntity> = {
        token,
        delta: grossAmount,
        user,
        reason: LedgerReason.REFUND,
        description: descriptionType.SUCCESSFUL,
      };
      if (token.asset !== DEFAULT_ASSET) {
        const ticker = await this.redisTickerService.getTicker(
          `${token.asset}${DEFAULT_ASSET}`,
        );
        refundLedger.priceUsdt = ticker?.lastPrice;
        const price = ticker?.lastPrice ?? '0';
        await this.balanceLotService.addRefundLot(
          balanceLotRepo,
          wallet,
          token,
          grossAmount,
          price,
        );
      }
      await ledgerRepo.save(ledgerRepo.create(refundLedger));

      const row = await txRepo.findOne({ where: { id: transactionId } });
      if (row) {
        row.status = TransactionStatus.FAILED;
        await txRepo.save(row);
      }
    });
  }

  private emitPayload(arg: {
    user: UserEntity;
    tx: TransactionHistoryEntity;
    networkId: string;
    toAddress: string;
    explorerUrl: string | null;
  }): void {
    const t = arg.tx.token;
    const payload: WithdrawalUpdatedEmitDto = {
      type: 'WITHDRAWAL_UPDATED',
      withdrawalId: arg.tx.id,
      userId: arg.user.id,
      networkId: arg.networkId,
      status: arg.tx.status,
      txHash: arg.tx.txHash,
      amount: arg.tx.amount,
      fee: arg.tx.fee,
      toAddress: arg.toAddress,
      tokenId: t.id,
      tokenSymbol: t.asset,
      explorerUrl: arg.explorerUrl,
    };
    this.eventEmitter.emit(WithdrawEvent.UPDATED, payload);
  }

  async caculatorFee(dto: CaculatorFeeDto) {
    const token = await this.tokenService.findById(dto.token_id);

    const data: Record<string, unknown> = {
      token,
      network_id: dto.network_id,
      amount: dto.amount,
      to_address: dto.to_address,
    };
    try {
      const result = await firstValueFrom(
        this.blockchainClient.send('caculatorFee', data),
      );
      this.logger.log(`caculatorFee result received for token ${dto.token_id}`);

      return result;
    } catch (error) {
      this.logger.error('Blockchain caculatorFee error:', error as Error);
    }
  }
}
