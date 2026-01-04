import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation } from '@nestjs/swagger';
import { WalletService } from 'src/modules/database/services';
import { AuthGuard } from '../guards/auth.guard';
import { BalanceEntity, walletType } from 'src/modules/database/entities';
import { TransferTokenByWalletDto } from '../dtos';

@Controller('wallets')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @ApiOperation({
    summary: 'get futures balance',
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('funding')
  async walletsFunding(@Req() req: Request): Promise<BalanceEntity[]> {
    const user = req['user'];
    return await this.walletService.getBalanceByWallet(
      walletType.FUNDING,
      user,
    );
  }

  @ApiOperation({
    summary: 'get futures balance',
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('spot')
  async walletsSpot(@Req() req: Request): Promise<BalanceEntity[]> {
    const user = req['user'];
    return await this.walletService.getBalanceByWallet(walletType.SPOT, user);
  }

  @ApiOperation({
    summary: 'get futures balance',
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('futures')
  async walletsFutures(@Req() req: Request): Promise<BalanceEntity[]> {
    const user = req['user'];
    return await this.walletService.getBalanceByWallet(walletType.FUTURE, user);
  }

  @ApiOperation({
    summary: 'Transfer funds between wallets',
  })
  @ApiBody({ type: TransferTokenByWalletDto })
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post('transfer')
  async transferFunds(
    @Body()
    body: TransferTokenByWalletDto,
    @Req() req: Request,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    const { fromWalletType, toWalletType, amount, assetToken } = body;
    const user = req['user'];
    return await this.walletService.transferFunds(
      user,
      fromWalletType,
      toWalletType,
      amount,
      assetToken,
    );
  }
}
