import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { walletType } from 'src/modules/database/entities';

export class getAllLedgerDto {
  @ApiProperty({ description: 'walletType for user', example: 'FUNDING' })
  @IsEnum(walletType)
  walletType: walletType;

  @ApiProperty({ description: 'assetToken', example: 'BTC', required: false })
  @IsOptional()
  assetToken?: string;
}
