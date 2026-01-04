import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LedgerEntity } from 'src/modules/database/entities';
import { LedgerService } from 'src/modules/database/services';
import { getAllLedgerDto } from '../dtos/ledger.dto';
import { AuthGuard } from '../guards/auth.guard';

@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @ApiOperation({ summary: 'endpoin get ledgers by walletType' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get()
  async getAll(
    @Query() query: getAllLedgerDto,
    @Request() req: any,
  ): Promise<LedgerEntity[]> {
    const user = req.user;
    return await this.ledgerService.getAll(user, query);
  }
}
