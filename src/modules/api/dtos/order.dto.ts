import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';
import {
  OrderSide,
  OrderType,
  walletType,
} from 'src/modules/database/entities';

export class OrderDtoCreate {
  @ApiProperty({
    description: 'symbol',
    example: 'BTCUSDT',
  })
  @IsString()
  symbol: string;

  @ApiProperty({
    description: 'side',
    example: OrderSide.SELL,
  })
  @IsString()
  side: OrderSide;

  @ApiProperty({
    description: 'type',
    example: OrderType.LIMIT,
  })
  @IsString()
  type: OrderType;

  @ApiProperty({
    description: 'wallet type',
    example: walletType.SPOT,
  })
  @IsEnum(walletType)
  walletType: walletType;

  @ApiProperty({
    description: 'price',
    example: '10',
  })
  @IsString()
  price: string;

  @ApiProperty({
    description: 'quantity',
    example: '10',
  })
  @IsString()
  quantity: string;

  @ApiProperty({
    description: 'quote_quantity',
    example: '100',
  })
  @IsString()
  quote_quantity: string;

  @ApiProperty({
    description: 'client_order_id for order',
    example: 'somethingOrder_01',
  })
  @IsString()
  client_order_id: string;
}

export class GetOrderHistoryDto {
  @ApiProperty({ example: '1827bvasci1267w' })
  marketToken_id: string;
}

export class CloseOrderDto {
  @ApiProperty({ example: '1827bvasci1267w' })
  order_id: string;

  @ApiProperty({ example: '1827bvasci1267w' })
  marketToken_id: string;
}
