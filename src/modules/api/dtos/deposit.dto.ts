import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class DepositGet {
  @ApiProperty({ description: 'user_id', example: 'nacjsabj1243' })
  @IsString()
  token_id: string;
}
