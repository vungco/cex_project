import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CloseOrderDto, GetOrderHistoryDto, OrderDtoCreate } from '../dtos';
import { OrderService } from 'src/modules/database/services/order.service';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '../guards/auth.guard';
import { OrderEntity } from 'src/modules/database/entities';
import { redisOrder } from 'src/modules/redis/constans/redis';

@Controller('orders')
export class OrderController {
  constructor(private orderService: OrderService) {}

  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({ status: 201, description: 'Order created successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiBody({ type: OrderDtoCreate })
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post()
  async create(@Body() body: OrderDtoCreate, @Request() req: any) {
    await this.orderService.create(body, req.user.id);
    return 'order accepted';
  }

  @ApiOperation({ summary: 'API get order history' })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách lịch sử order thành công',
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('history')
  async getOrderHistory(
    @Query() query: GetOrderHistoryDto,
    @Request() req: any,
  ): Promise<OrderEntity[]> {
    const user = req.user;
    return await this.orderService.getOrderHistory(query, user);
  }

  @ApiOperation({ summary: 'API get order snapshot' })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách lịch sử order thành công',
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('snapshot')
  async getOrderSnapshot(
    @Query() query: GetOrderHistoryDto,
    @Request() req: any,
  ): Promise<redisOrder[]> {
    const user = req.user;
    return await this.orderService.getOrderSnapshot(query, user);
  }

  @ApiOperation({ summary: 'API get order snapshot' })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách lịch sử order thành công',
  })
  @ApiBearerAuth()
  @ApiBody({ type: CloseOrderDto })
  @UseGuards(AuthGuard)
  @Post('closeOrder')
  async closeOrder(
    @Body() body: CloseOrderDto,
    @Request() req: any,
  ): Promise<void> {
    const user = req.user;
    return await this.orderService.closeOrder(body, user);
  }
}
