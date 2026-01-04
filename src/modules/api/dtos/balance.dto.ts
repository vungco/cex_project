import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { LedgerReason, walletType } from 'src/modules/database/entities';

export class BalacneDtoCreate {
  @ApiProperty({
    description: 'user_email',
    example: 'something@gmail.com',
  })
  @IsString()
  @ValidateIf((o) => !o.user_id)
  user_email: string;

  @ApiProperty({
    description: 'asset',
    example: 'USDT',
  })
  @IsString()
  asset: string;

  @ApiProperty({
    description: 'wallet type',
    example: 'FUNDING',
  })
  @IsEnum(walletType)
  typeWallet: walletType;

  @ApiProperty({
    description: 'available for asset',
    example: '10000',
  })
  @IsString()
  available: string;

  @ApiProperty({
    description: 'reason',
    example: 'DEPOSIT',
  })
  @IsString()
  reason: LedgerReason;

  @ApiProperty({
    description: 'ref_id for order or null',
    example: '10',
  })
  @IsString()
  @IsOptional()
  ref_id?: string;
}

export class GetTokenBalanceDetailDto {
  @ApiProperty({ description: 'Symbol for token', example: 'BTC' })
  @IsString()
  symbol: string;

  @ApiProperty({
    description: 'Start date (ISO format, optional)',
    example: '2025-09-01T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiProperty({
    description: 'End date (ISO format, optional)',
    example: '2025-10-29T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsString()
  toDate?: string;

  @ApiProperty({
    description: 'Number of recent days to include (e.g. 7, 30, 90)',
    example: 30,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(30)
  rangeDays?: number;
}

export class ResponseDetailTokenDto {
  symbol: string;

  daily_pnlPercent: string;
  daily_pnl: string;

  cost_pnlPercent: string;
  cost_pnl: string;

  cumulative_pnlPercent: string;
  cumulative_pnl: string;

  avgPrice: string;
  costPrice: string;

  marketPrice: string;
}

export class getTokenBalanceDetalDto {
  @ApiProperty({ description: 'asset', example: 'BTC' })
  @IsString()
  asset: string;
}
