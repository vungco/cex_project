import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class MarketTokenCreateDto {
  @ApiProperty({ example: 'BTC' })
  @IsString()
  baseAsset: string;

  @ApiProperty({ example: 'USDT' })
  @IsString()
  quoteAsset: string;
}

export class MarketTokenActiveDto {
  @ApiProperty({ example: 'ETHUSDT' })
  @IsString()
  symbol: string;

  @ApiProperty({ description: 'price for init mk', example: '0.5' })
  @IsString()
  @IsOptional()
  initPrice?: string;

  @ApiProperty({ example: 'true' })
  @IsString()
  isActive: string;
}
