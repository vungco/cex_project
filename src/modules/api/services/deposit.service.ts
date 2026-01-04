import { Injectable, OnModuleInit } from '@nestjs/common';
import EventEmitter2 from 'eventemitter2';
import { DepositWalletEntity } from 'src/modules/database/entities/deposit-wallet.entity';
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
import { RedisBaseService } from 'src/modules/redis/services/redis.base.service';
import { DepositEvent } from 'src/shared/enums/enum';

@Injectable()
export class DepositServiceSub implements OnModuleInit {
  constructor(
    private readonly depositWalletService: DepositWalletService,
    private readonly redisService: RedisBaseService,
    private readonly transactionHistoryService: TransactionHistoryService,
    private readonly eventEmiter: EventEmitter2,
    private readonly tokenService: TokenService,
    private readonly balanceService: BalanceService,
  ) {}

  onModuleInit() {
    const DEPOSIT = 'DEPOSIT';
    this.redisService.subscribe(DEPOSIT, async (data: any) => {
      const parData: any = JSON.parse(data);
      const {
        user_id,
        token_id,
        network_id,
        excu_address,
        txHash,
        value,
        fee,
      } = parData;

      if (user_id && value) {
        let deposit: DepositWalletEntity;
        const token = await this.tokenService.findById(token_id);

        if (token_id) {
          deposit = await this.depositWalletService.getDeposit(
            user_id,
            token_id,
          );
        } else {
          deposit = await this.depositWalletService.getDeposit(
            user_id,
            token.id,
          );
        }

        await this.balanceService.depositToken(
          deposit.wallet,
          token_id,
          value,
          user_id,
        );
        const depositHistory: EmitResponHistoryDto = {
          user: deposit.wallet.user,
          token,
          networkId: network_id,
          amount: value,
          excuAddress: excu_address,
          txHash,
          status: TransactionStatus.CONFIRMED,
          type: TransactionType.DEPOSIT,
          fee,
        };
        await this.transactionHistoryService.create(depositHistory);

        this.eventEmiter.emit(DepositEvent.CREATE, depositHistory);
      }
    });
  }
}
