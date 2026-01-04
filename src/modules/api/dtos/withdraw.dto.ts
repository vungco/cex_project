import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsString,
  IsNumberString,
  Length,
  IsOptional,
} from 'class-validator';

export class CreateWithdrawDto {
  @ApiProperty({
    description: 'ID của network (từ service network)',
    example: '2b630e4a-1734-455f-b9bc-9318703af255',
  })
  @IsUUID()
  network_id: string;

  @ApiProperty({
    description: 'ID của token được rút (VD: USDT, ETH...)',
    example: '491645b8-8f6c-471c-a342-c74d79c14b66',
  })
  @IsUUID()
  token_id: string;

  @ApiProperty({
    description: 'Địa chỉ ví đích của người dùng',
    example: '0x50dc2c86059c5d68477768785f99629445598bec',
  })
  @IsString()
  @Length(20, 100)
  to_address: string;

  @ApiProperty({
    description: 'Số lượng token cần rút',
    example: '20',
  })
  @IsNumberString()
  amount: string;
}

export class CaculatorFeeDto {
  @ApiProperty({
    description: 'ID của network (từ service network)',
    example: '2b630e4a-1734-455f-b9bc-9318703af255',
  })
  @IsUUID()
  network_id: string;

  @ApiProperty({
    description: 'ID của token được rút (VD: USDT, ETH...)',
    example: '491645b8-8f6c-471c-a342-c74d79c14b66',
  })
  @IsUUID()
  token_id: string;

  @ApiProperty({
    description: 'Địa chỉ ví đích của người dùng',
    example: '0x50dc2c86059c5d68477768785f99629445598bec',
  })
  @IsString()
  @Length(20, 100)
  to_address: string;

  @ApiProperty({
    description: 'Số lượng token cần rút',
    example: '20',
  })
  @IsNumberString()
  amount: string;
}
