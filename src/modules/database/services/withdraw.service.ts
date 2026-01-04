import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
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
  lotType,
  UserEntity,
  WalletEntity,
  walletType,
} from '../entities';
import { TransactionHistoryReposirory } from '../repositories/transaction-history.repository';
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

@Injectable()
export class WithdrawService {
  constructor(
    private readonly tokenService: TokenService,
    private readonly walletService: WalletService,
    private readonly balanceLotService: BalanceLotService,
    private readonly redisTickerService: RedisTickerService,
    @Inject('BLOCKCHAIN_SERVICE')
    private readonly blockchainClient: ClientProxy,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async createWithdraw(
    dto: CreateWithdrawDto,
    user: UserEntity,
  ): Promise<{
    txHash: string;
    amount: string;
    fee: string;
    tokenId: string;
    networkId: string;
    status: TransactionStatus;
    type: TransactionType;
  }> {
    const { token_id, network_id, to_address, amount } = dto;

    try {
      const feeToken: { fee: string; feeMin: string } = await firstValueFrom(
        this.blockchainClient.send('feeTokenWithdraw', {
          token_id,
          network_id,
        }),
      );

      if (new Decimal(amount).lessThan(feeToken.feeMin)) {
        throw new Error('Amount must be greater than minimum fee');
      }

      const token = await this.tokenService.findById(token_id);
      const wallet = await this.walletService.getWallet(
        walletType.FUNDING,
        user,
      );

      if (!token) throw new NotFoundException('Token not found');
      if (!wallet) throw new NotFoundException('Funding wallet not found');

      const withdrawAmount = new Decimal(amount).minus(feeToken.fee).toString();

      const result: { txHash: string } = await firstValueFrom(
        this.blockchainClient.send('withdraw', {
          token,
          user_id: user.id,
          network_id,
          to_address,
          amount: withdrawAmount,
        }),
      );

      // Transaction DB
      const txHistory = await this.dataSource.transaction(async (manager) => {
        const balanceRepo = manager.getRepository(BalanceEntity);
        const ledgerRepo = manager.getRepository(LedgerEntity);
        const balanceLotRepo = manager.getRepository(BalanceLotEntity);
        const txRepo = manager.getRepository(TransactionHistoryEntity);

        const balance = await balanceRepo.findOne({
          where: { wallet: { id: wallet.id }, token: { id: token.id } },
        });
        if (!balance) throw new NotFoundException('Balance not found');

        balance.available = new Decimal(balance.available)
          .minus(amount)
          .toString();
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

        const ledger = ledgerRepo.create(ledgerData);
        await ledgerRepo.save(ledger);

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
          txHash: result.txHash,
          status: TransactionStatus.CONFIRMED,
          type: TransactionType.WITHDRAWAL,
        });
        await txRepo.save(tx);

        return tx;
      });

      return {
        txHash: txHistory.txHash,
        amount: txHistory.amount,
        fee: txHistory.fee,
        tokenId: token.id,
        networkId: network_id,
        status: txHistory.status,
        type: txHistory.type,
      };
    } catch (error) {
      console.error('Blockchain withdraw failed:', error);
      if (error instanceof RpcException) throw error;

      throw new HttpException(
        error?.message || 'Blockchain withdraw failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async caculatorFee(dto: CaculatorFeeDto) {
    const token = await this.tokenService.findById(dto.token_id);

    const data: any = {
      token,
      network_id: dto.network_id,
      amount: dto.amount,
      to_address: dto.to_address,
    };
    try {
      const result = await firstValueFrom(
        this.blockchainClient.send('caculatorFee', data),
      );
      console.log('result: ', result);

      return result;
    } catch (error) {
      console.error('Blockchain caculatorFee error:', error);
    }
  }
}
