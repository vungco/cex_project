import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { WithdrawService } from 'src/modules/database/services/withdraw.service';
import { CaculatorFeeDto, CreateWithdrawDto } from '../dtos/withdraw.dto';
import { AuthGuard } from '../guards/auth.guard';
import {
  TransactionStatus,
  TransactionType,
} from 'src/modules/database/entities/transaction-history.entity';

@ApiTags('Withdraw')
@Controller('withdraw')
export class WithdrawController {
  constructor(private readonly withdrawService: WithdrawService) {}

  @Post('caculaterFee')
  @ApiOperation({ summary: 'caculatorFee' })
  @ApiResponse({
    status: 201,
    description: 'Tạo yêu cầu rút tiền thành công',
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiBody({ type: CaculatorFeeDto })
  async caculatorFee(@Body() dto: CaculatorFeeDto): Promise<void> {
    return await this.withdrawService.caculatorFee(dto);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo yêu cầu rút tiền từ sàn về ví người dùng' })
  @ApiResponse({
    status: 201,
    description: 'Tạo yêu cầu rút tiền thành công',
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiBody({ type: CreateWithdrawDto })
  async createWithdraw(
    @Body() dto: CreateWithdrawDto,
    @Request() req: any,
  ): Promise<{
    txHash: string;
    amount: string;
    fee: string;
    tokenId: string;
    networkId: string;
    status: TransactionStatus;
    type: TransactionType;
  }> {
    const user = req.user;
    return await this.withdrawService.createWithdraw(dto, user);
  }
}
