import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TransactionHistoryEntity } from 'src/modules/database/entities/transaction-history.entity';
import { TransactionHistoryService } from 'src/modules/database/services/transaction-history.service';
import { AuthGuard } from '../guards/auth.guard';

@ApiTags('transactions')
@UseGuards(AuthGuard)
@Controller('transactions')
export class TransactionHistoryController {
  constructor(
    private readonly transactionHistoryService: TransactionHistoryService,
  ) {}

  /** Lấy tất cả giao dịch của user */
  @Get('all')
  async getAll(@Request() req: any): Promise<TransactionHistoryEntity[]> {
    const user = req.user;
    return this.transactionHistoryService.getAllByUser(user);
  }

  /** Lấy lịch sử nạp tiền */
  @Get('deposits')
  async getDeposits(@Request() req: any): Promise<TransactionHistoryEntity[]> {
    const user = req.user;

    return this.transactionHistoryService.getDeposits(user);
  }

  /** Lấy lịch sử rút tiền */
  @Get('withdrawals')
  async getWithdrawals(
    @Request() req: any,
  ): Promise<TransactionHistoryEntity[]> {
    const user = req.user;

    return this.transactionHistoryService.getWithdrawals(user);
  }
}
