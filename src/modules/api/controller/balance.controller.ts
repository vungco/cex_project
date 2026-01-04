import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { BalanceService } from 'src/modules/database/services/balance.service';
import {
  BalacneDtoCreate,
  GetTokenBalanceDetailDto,
  getTokenBalanceDetalDto,
} from '../dtos/balance.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { AdminGuard } from '../guards/admin.guard';
import { BalanceEntity } from 'src/modules/database/entities';
import { AuthGuard } from '../guards/auth.guard';

@Controller('balances')
export class BalanceController {
  constructor(private readonly balanceSer: BalanceService) {}

  @ApiOperation({
    summary: 'create api balance for register',
  })
  @ApiResponse({
    status: 201,
    description: 'created',
  })
  @ApiResponse({
    status: 400,
    description: 'error',
  })
  @ApiBody({
    type: BalacneDtoCreate,
  })
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Post()
  async create(@Body() body: BalacneDtoCreate): Promise<{
    success: boolean;
  }> {
    return await this.balanceSer.create(body);
  }

  @ApiOperation({ summary: 'get pnl for all token balance' })
  @ApiResponse({
    status: 201,
    description: 'get',
  })
  @ApiResponse({
    status: 400,
    description: 'error',
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get()
  async getPnlAllTokenBalance(
    @Request() req: any,
  ): Promise<{ balance: Partial<BalanceEntity>; pnl?: string | null }[]> {
    const user = req.user;
    return this.balanceSer.getPnlTokenBalanceSpot(user);
  }

  @ApiOperation({ summary: 'get detail pnl for token balance' })
  @ApiResponse({
    status: 201,
    description: 'get',
  })
  @ApiResponse({
    status: 400,
    description: 'error',
  })
  @ApiBody({ type: getTokenBalanceDetalDto })
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post('detail')
  async getPnlTokenBalance(
    @Request() req: any,
    @Body() body: getTokenBalanceDetalDto,
  ) {
    const user = req.user;

    return this.balanceSer.getDetailPnlTokenBalance(body.asset, user);
  }

  @ApiOperation({ summary: 'get chart details for token balance' })
  @ApiResponse({
    status: 201,
    description: 'get',
  })
  @ApiResponse({
    status: 400,
    description: 'error',
  })
  @ApiBody({ type: GetTokenBalanceDetailDto })
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('chart')
  async getDetailTokenForBalance(
    @Query() query: GetTokenBalanceDetailDto,
    @Request() req: any,
  ) {
    const user = req.user;
    return this.balanceSer.getChartTokenBalance();
  }
}
