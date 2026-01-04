import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  CloseOrderDto,
  GetOrderHistoryDto,
  OrderDtoCreate,
} from 'src/modules/api/dtos';
import { BalanceService } from './balance.service';
import { MarketTokenService } from './market-token.service';
import Decimal from 'decimal.js';
import {
  LedgerEntity,
  LedgerReason,
  OrderEntity,
  OrderSide,
  OrderStatus,
  OrderType,
  UserEntity,
  walletType,
} from '../entities';
import { BalanceRepository, OrderRepository } from '../repositories';
import { redisOrder } from 'src/modules/redis/constans/redis';
import { RedisOrderBookService } from 'src/modules/redis/services/redis.orderbook.service';
import { LedgerService } from './ledger.service';
import { QUEUE_PROCESSOR } from 'src/modules/queue/constants/queue';
import { QueueService } from 'src/modules/queue/services/queue.service';

@Injectable()
export class OrderService {
  private logger = new Logger(OrderService.name);
  constructor(
    private readonly balanceService: BalanceService,
    private readonly balanceRepo: BalanceRepository,
    private readonly ledgerSer: LedgerService,
    private readonly marketTokenService: MarketTokenService,
    private readonly redisOrderBookService: RedisOrderBookService,
    private readonly orderRepo: OrderRepository,
    private readonly queueService: QueueService,
  ) {}

  async create(order: OrderDtoCreate, user_id: string): Promise<void> {
    const mk = await this.marketTokenService.findByName(order.symbol);
    if (!mk.isActive) {
      throw new BadRequestException(
        `Market for ${order.symbol} is temporarily inactive.`,
      );
    }

    const priceVali = new Decimal(order.price)
      .toDecimalPlaces(8, Decimal.ROUND_DOWN)
      .toString();
    const baseAsset = new Decimal(order.quantity)
      .toDecimalPlaces(8, Decimal.ROUND_DOWN)
      .toString();
    const quoteAsset = new Decimal(order.quote_quantity)
      .toDecimalPlaces(8, Decimal.ROUND_DOWN)
      .toString();
    order.price = priceVali;
    order.quantity = baseAsset;
    order.quote_quantity = quoteAsset;

    const balance = await this.balanceService.checkBalance(order, user_id);
    if (balance.error) {
      throw new InternalServerErrorException(balance.message);
    }
    await this.queueService.addOrderJob(order, user_id);
  }

  async getOrderHistory(
    query: GetOrderHistoryDto,
    user: UserEntity,
  ): Promise<OrderEntity[]> {
    const { marketToken_id } = query;

    const orders = await this.orderRepo.find({
      where: { market_token: { id: marketToken_id }, user: { id: user.id } },
      order: { createdAt: 'DESC' },
    });

    if (!orders.length) {
      throw new NotFoundException(`orderHistory not found`);
    }
    return orders;
  }

  async getOrderSnapshot(
    query: GetOrderHistoryDto,
    user: UserEntity,
  ): Promise<redisOrder[]> {
    const { marketToken_id } = query;

    const marketToken = await this.marketTokenService.findById(marketToken_id);

    const orders = this.redisOrderBookService.getUserOrders(
      user.id,
      marketToken.symbol,
    );
    return orders;
  }

  async closeOrder(query: CloseOrderDto, user: UserEntity): Promise<void> {
    try {
      const { order_id, marketToken_id } = query;

      const marketToken =
        await this.marketTokenService.findById(marketToken_id);
      const order = await this.redisOrderBookService.getOrderByUser(
        order_id,
        user.id,
        marketToken.symbol,
      );
      const waType = walletType.SPOT;

      if (order.type === OrderType.MARKET) return;

      await this.redisOrderBookService.deleteOrder(
        marketToken.symbol,
        order.side,
        order.id,
        order.price,
        user.id,
      );

      //caculater filled
      order.status = OrderStatus.CANCELLED;

      if (order.side === OrderSide.BUY) {
        if (order.quote_quantity !== order.filled_quote_quantity) {
          const notMatchYet = new Decimal(order.quote_quantity).minus(
            order.filled_quote_quantity,
          );

          const balanceQuote = await this.balanceService.getBalances(
            user,
            marketToken.quoteToken.asset,
            waType,
          );
          balanceQuote.locked = new Decimal(balanceQuote.locked)
            .minus(notMatchYet)
            .toDecimalPlaces(8, Decimal.ROUND_DOWN)
            .toString();

          balanceQuote.available = new Decimal(balanceQuote.available)
            .plus(notMatchYet)
            .toDecimalPlaces(8, Decimal.ROUND_DOWN)
            .toString();

          await Promise.all([
            this.balanceRepo.save(balanceQuote),
            this.ledgerSer.create(
              notMatchYet.toString(),
              null,
              LedgerReason.REFUND,
              marketToken.quoteToken,
              user,
            ),
            this.orderRepo.save(this.orderRepo.create(order)),
          ]);
        }
      } else {
        if (order.quantity !== order.filled_quantity) {
          const notMatchYet = new Decimal(order.quantity).minus(
            order.filled_quantity,
          );

          const balanceBase = await this.balanceService.getBalances(
            user,
            marketToken.baseToken.asset,
            waType,
          );
          balanceBase.locked = new Decimal(balanceBase.locked)
            .minus(notMatchYet)
            .toDecimalPlaces(8, Decimal.ROUND_DOWN)
            .toString();

          balanceBase.available = new Decimal(balanceBase.available)
            .plus(notMatchYet)
            .toDecimalPlaces(8, Decimal.ROUND_DOWN)
            .toString();

          await Promise.all([
            this.balanceRepo.save(balanceBase),
            this.ledgerSer.create(
              notMatchYet.toString(),
              null,
              LedgerReason.REFUND,
              marketToken.quoteToken,
              user,
            ),
            this.orderRepo.save(this.orderRepo.create(order)),
          ]);
        }
      }
    } catch (error) {
      this.logger.error(`error while close Order ${query.order_id}`);
    }
  }
}
