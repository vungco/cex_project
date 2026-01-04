import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString } from 'class-validator';

export class TokenCreateDto {
  @ApiProperty({ example: 'BTC', description: 'Token symbol' })
  @IsString()
  asset: string;

  @ApiProperty({ example: 'Bitcoin', description: 'Token name' })
  @IsString()
  name: string;

  @ApiProperty({ example: false, description: 'Is native token' })
  @IsBoolean()
  is_native: boolean;
}
