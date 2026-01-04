import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TickerService } from 'src/modules/database/services/ticker.service';

@Controller('ticker/24hr')
export class TickerController {
  constructor(private readonly tickerService: TickerService) {}

  @ApiOperation({ summary: 'endpoin get all ticker' })
  @ApiResponse({ status: 200, description: 'Return all current tickers' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @Get()
  async getAllTickerCurrent(): Promise<any> {
    return await this.tickerService.getAllTickerCurrent();
  }
}
