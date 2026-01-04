import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DepositGet } from '../dtos/deposit.dto';
import { AuthGuard } from '../guards/auth.guard';
import { DepositWalletEntity } from 'src/modules/database/entities/deposit-wallet.entity';
import { DepositWalletService } from 'src/modules/database/services/deposit-wallet.service';

@Controller('deposit')
export class DepositWalletController {
  constructor(private readonly depositService: DepositWalletService) {}

  @Post()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get deposits' })
  @ApiResponse({
    status: 200,
    description: 'List of deposits',
  })
  async getDeposit(
    @Body() body: DepositGet,
    @Request() req: any,
  ): Promise<DepositWalletEntity> {
    const user = req.user;
    return await this.depositService.getDeposit(user.id, body.token_id);
  }
}
