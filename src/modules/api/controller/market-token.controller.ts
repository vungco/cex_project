import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { MarketTokenService } from 'src/modules/database/services';
import { MarketTokenActiveDto, MarketTokenCreateDto } from '../dtos';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { MarketTokenEntity } from 'src/modules/database/entities/market-token.entity';
import { AuthGuard } from '../guards/auth.guard';

@Controller('market-tokens')
export class MarketTokenController {
  constructor(private readonly marketTokenService: MarketTokenService) {}

  @ApiOperation({ description: 'Create a new market token' })
  @ApiResponse({
    status: 201,
    description: 'The market token has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiBody({ type: MarketTokenCreateDto })
  @ApiBearerAuth()
  @Post()
  async create(
    @Body() body: MarketTokenCreateDto,
  ): Promise<{ success: boolean; marketToken: any }> {
    return await this.marketTokenService.create(body);
  }

  @ApiOperation({ summary: 'api get marketToken current' })
  @ApiResponse({
    status: 201,
    description: 'The market token has been get all.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get()
  async getAdd(): Promise<MarketTokenEntity[]> {
    return this.marketTokenService.getAll();
  }

  @ApiOperation({ summary: 'api active marketToken' })
  @ApiResponse({
    status: 201,
    description: 'The market token has been active.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiBearerAuth()
  @ApiBody({ type: MarketTokenActiveDto })
  @UseGuards(AuthGuard)
  @Post('active')
  async activeMarketToken(@Body() body: MarketTokenActiveDto): Promise<void> {
    return await this.marketTokenService.handleActiveMarketToken(
      body.symbol,
      body.isActive,
      body.initPrice,
    );
  }
}
