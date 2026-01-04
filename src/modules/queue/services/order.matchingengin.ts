import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import dayjs from 'dayjs';
import Decimal from 'decimal.js';
import { OrderDtoCreate } from 'src/modules/api/dtos';
import {
  BalanceEntity,
  BalanceLotEntity,
  descriptionType,
  LedgerEntity,
  LedgerReason,
  OrderEntity,
  OrderSide,
  OrderStatus,
  OrderType,
  TradeEntity,
  UserEntity,
  walletType,
} from 'src/modules/database/entities';
import { MarketTokenEntity } from 'src/modules/database/entities/market-token.entity';
import {
  MarketTokenRepository,
  OrderRepository,
  UserRepository,
} from 'src/modules/database/repositories';
import {
  BalanceService,
  MarketTokenService,
  TokenService,
  WalletService,
} from 'src/modules/database/services';
import {
  OrderBookResponse,
  redisBalance,
  redisBalanceLot,
  redisLedger,
  redisOrder,
  redisTrade,
} from 'src/modules/redis/constans/redis';
import { tickerRedis, timeFrameCandles } from 'src/shared/constans';
import { SpotEvent } from 'src/shared/enums/enum';
import { DataSource, In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { BalanceLotFifo } from './balance-lot.service';
import { RealizedPnlEntity } from 'src/modules/database/entities/realized_pnl_history';
import { TickerService } from 'src/modules/database/services/ticker.service';
import { RedisBaseService } from 'src/modules/redis/services/redis.base.service';
import { RedisOrderBookService } from 'src/modules/redis/services/redis.orderbook.service';
import { RedisCandleService } from 'src/modules/redis/services/redis.candle.service';
import { RedisTickerService } from 'src/modules/redis/services/redis.ticker.service';

@Injectable()
export class MatchingEnginService {
  private readonly toCreateOrders: redisOrder[] = [];
  private readonly trades: redisTrade[] = [];
  private readonly balances: redisBalance[] = [];
  private readonly ledgers: redisLedger[] = [];
  private readonly balance_lots: redisBalanceLot[] = [];
  private readonly logger = new Logger(MatchingEnginService.name);
  @InjectDataSource()
  private readonly dataSource: DataSource;
  private balanceAssetBaseForUser: BalanceEntity | null = null;
  private balanceAssetQuoteForUser: BalanceEntity | null = null;

  constructor(
    private readonly redisService: RedisBaseService,
    private readonly redisOrderBookService: RedisOrderBookService,
    private readonly redisCandleService: RedisCandleService,
    private readonly redisTickerService: RedisTickerService,
    private readonly balanceService: BalanceService,
    private readonly userRepo: UserRepository,
    private readonly market_tokenService: MarketTokenService,
    private readonly orderRepo: OrderRepository,
    private readonly marketTokenRepo: MarketTokenRepository,
    private readonly balance_lotFifo: BalanceLotFifo,
    private readonly tickerService: TickerService,
    private readonly tokenService: TokenService,
    private readonly walletSe: WalletService,
  ) {}

  async getUserAndMarketToken(
    user_id: string,
    symbol: string,
  ): Promise<[UserEntity, MarketTokenEntity]> {
    return await Promise.all([
      this.userRepo.findById(user_id),
      this.market_tokenService.findByName(symbol),
    ]);
  }

  async handleLimitOrder(
    _order: OrderDtoCreate,
    user_id: string,
  ): Promise<void> {
    const orderId = uuidv4();

    const [user, market_token] = await this.getUserAndMarketToken(
      user_id,
      _order.symbol,
    );

    const order: redisOrder = {
      id: orderId,
      user,
      market_token,
      side: _order.side,
      type: OrderType.LIMIT,
      price: _order.price,
      quantity: _order.quantity,
      quote_quantity: _order.quote_quantity,
      filled_quantity: '0',
      filled_quote_quantity: '0',
      status: OrderStatus.NEW,
      client_order_id: _order.client_order_id,
    };

    await Promise.all([
      this.redisOrderBookService.addOrder(_order.symbol, order.side, order),
      this.orderRepo.save(this.orderRepo.create(order)),
    ]);
  }

  async handleMarketOrder(
    order: OrderDtoCreate,
    user_id: string,
  ): Promise<any> {
    const orderId = uuidv4();

    const [user, market_token] = await this.getUserAndMarketToken(
      user_id,
      order.symbol,
    );

    const takerOrder: redisOrder = {
      id: orderId,
      user,
      market_token,
      side: order.side,
      type: OrderType.MARKET,
      price: order.price, // determined dynamically
      quantity: order.quantity,
      filled_quantity: '0',
      status: OrderStatus.NEW,
      client_order_id: order.client_order_id,
      quote_quantity: order.quote_quantity,
      filled_quote_quantity: '0',
      avg_price: '0',
    };

    const oppositeSide =
      takerOrder.side === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY;

    const orderbook = await this.redisOrderBookService.getOrderBook(
      order.symbol,
      oppositeSide,
    );

    if (!orderbook.length) {
      this.logger.error(`${oppositeSide} not long enouge`);
      return { matched: false };
    }

    let remainAsset = new Decimal(0);

    if (takerOrder.side == OrderSide.BUY) {
      remainAsset = new Decimal(takerOrder.quote_quantity)!;
      await this.matchBuyMarketOrder(
        takerOrder,
        orderbook,
        order,
        market_token,
        remainAsset,
        oppositeSide,
      );
    } else {
      remainAsset = new Decimal(takerOrder.quantity)!;
      await this.matchSellMarketOrder(
        takerOrder,
        orderbook,
        order,
        market_token,
        remainAsset,
        oppositeSide,
      );
    }

    await this.handleWriteToDB();
    await this.redisService.publish(
      SpotEvent.TradeMatch,
      JSON.stringify({ symbol: market_token.symbol, trades: this.trades }),
    );
    this.resetCatch();
    this.balance_lotFifo.resetAll();
  }

  async matchBuyMarketOrder(
    takerOrder: redisOrder,
    orderbook: OrderBookResponse,
    order: OrderDtoCreate,
    market_token: MarketTokenEntity,
    remainQuote: Decimal,
    oppositeSide: OrderSide,
  ) {
    let totalBaseFilled = new Decimal(0);
    let totalQuoteSpent = new Decimal(0);

    for (const level of orderbook) {
      const { price, orders } = level;

      for (const makerOrder of orders) {
        if (takerOrder.user.id === makerOrder.user.id) continue;
        const tradeQuoteValue = new Decimal(makerOrder.quote_quantity).minus(
          makerOrder.filled_quote_quantity,
        );

        // Check how much quote value we can still spend
        const usedQuote = Decimal.min(remainQuote, tradeQuoteValue);
        const matchedBaseQty = new Decimal(usedQuote)
          .div(price)
          .toDecimalPlaces(8, Decimal.ROUND_DOWN);

        console.log('usedQuote: ', usedQuote);
        console.log('matchedBaseQty: ', matchedBaseQty);

        remainQuote = new Decimal(remainQuote).minus(usedQuote);

        // Update taker & maker filled quantities
        takerOrder.filled_quantity = matchedBaseQty
          .plus(takerOrder.filled_quantity)
          .toString();
        takerOrder.filled_quote_quantity = new Decimal(
          takerOrder.filled_quote_quantity,
        )
          .add(usedQuote)
          .toString();

        makerOrder.filled_quantity = matchedBaseQty
          .plus(makerOrder.filled_quantity)
          .toString();
        makerOrder.filled_quote_quantity = usedQuote
          .plus(makerOrder.filled_quote_quantity)
          .toString();

        totalBaseFilled = totalBaseFilled.plus(matchedBaseQty);
        totalQuoteSpent = totalQuoteSpent.plus(usedQuote);

        if (
          new Decimal(makerOrder.filled_quote_quantity).greaterThanOrEqualTo(
            makerOrder.quote_quantity,
          )
        ) {
          makerOrder.status = OrderStatus.FILLED;
          await this.redisOrderBookService.deleteOrder(
            makerOrder.market_token.symbol,
            oppositeSide,
            makerOrder.id,
            makerOrder.price,
            makerOrder.user.id,
          );
        } else {
          makerOrder.status = OrderStatus.PARTIALLY_FILLED;
          await this.redisOrderBookService.updateOrder(
            makerOrder.market_token.symbol,
            oppositeSide,
            makerOrder.id,
            makerOrder.price,
            makerOrder,
          );
        }
        this.toCreateOrders.push(makerOrder);

        await this.pushToBalanceAndLedger(
          makerOrder.user.id,
          oppositeSide,
          order.walletType,
          market_token.baseToken.asset,
          market_token.quoteToken.asset,
          usedQuote.toString(),
          matchedBaseQty.toString(),
          price.toString(),
        );

        // add candle into redis
        for (const interval of timeFrameCandles) {
          await this.redisCandleService.updateCandle(
            market_token.symbol,
            interval,
            price,
            matchedBaseQty.toString(),
            dayjs().valueOf(),
          );
        }

        //update ticker redis
        await this.updateTicker(
          new Decimal(price),
          matchedBaseQty,
          usedQuote,
          market_token,
        );

        //emit handle balance_lots
        await this.balance_lotFifo.pushToBalanceLot(
          takerOrder.side,
          takerOrder.user.id,
          order.walletType,
          market_token.baseToken.asset,
          market_token.quoteToken.asset,
          new Decimal(price),
          matchedBaseQty,
        );

        await this.balance_lotFifo.pushToBalanceLot(
          makerOrder.side,
          makerOrder.user.id,
          order.walletType,
          market_token.baseToken.asset,
          market_token.quoteToken.asset,
          new Decimal(price),
          matchedBaseQty,
        );

        this.trades.push({
          price,
          quantity: matchedBaseQty.toString(),
          quote_quantity: usedQuote.toString(),
          taker_order: this.orderRepo.create(takerOrder),
          maker_order: this.orderRepo.create(makerOrder),
          market_token: this.marketTokenRepo.create(market_token),
          tradeTime: dayjs().valueOf(),
        });

        if (remainQuote.lessThanOrEqualTo(0)) break;
      }
      if (remainQuote.lessThanOrEqualTo(0)) break;
    }

    takerOrder.avg_price = totalBaseFilled.greaterThan(0)
      ? totalQuoteSpent
          .div(totalBaseFilled)
          .toDecimalPlaces(8, Decimal.ROUND_DOWN)
          .toString()
      : '0';
    // Final status
    if (remainQuote.lessThanOrEqualTo(0)) {
      takerOrder.status = OrderStatus.FILLED;
      await this.pushToBalanceAndLedger(
        takerOrder.user.id,
        order.side,
        order.walletType,
        market_token.baseToken.asset,
        market_token.quoteToken.asset,
        totalQuoteSpent.toString(),
        totalBaseFilled.toString(),
        takerOrder.avg_price,
      );
    } else if (new Decimal(takerOrder.filled_quantity).greaterThan(0)) {
      takerOrder.status = OrderStatus.PARTIALLY_FILLED;
      const remain =
        takerOrder.side === OrderSide.BUY
          ? remainQuote
          : Number(takerOrder.quantity) - Number(takerOrder.filled_quantity);
      await this.handleReimberForOrderPartial(
        takerOrder.user.id,
        order.side,
        order.walletType,
        market_token.baseToken.asset,
        market_token.quoteToken.asset,
        totalQuoteSpent.toString(),
        totalBaseFilled.toString(),
        remain.toString(),
        takerOrder.avg_price,
      );
    } else {
      takerOrder.status = OrderStatus.CANCELLED;

      await this.cancelOrder(
        takerOrder.user.id,
        order.side,
        order.walletType,
        market_token.baseToken.asset,
        market_token.quoteToken.asset,
        remainQuote.toString(),
      );

      await this.redisService.publish(
        SpotEvent.OrderCancelled,
        JSON.stringify(takerOrder),
      );
    }

    this.toCreateOrders.push(takerOrder);
  }

  async matchSellMarketOrder(
    takerOrder: redisOrder,
    orderbook: OrderBookResponse,
    order: OrderDtoCreate,
    market_token: MarketTokenEntity,
    remainBase: Decimal,
    oppositeSide: OrderSide,
  ) {
    let totalBaseFilled = new Decimal(0);
    let totalQuoteSpent = new Decimal(0);

    for (const level of orderbook) {
      const { price, orders } = level;

      for (const makerOrder of orders) {
        if (takerOrder.user.id === makerOrder.user.id) continue;
        const tradeBaseValue = new Decimal(makerOrder.quantity).minus(
          makerOrder.filled_quantity,
        );

        // Check how much quote value we can still spend
        const usedBase = Decimal.min(remainBase, tradeBaseValue);
        const matchedQuoteQty = new Decimal(usedBase)
          .times(price)
          .toDecimalPlaces(8, Decimal.ROUND_DOWN);

        remainBase = new Decimal(remainBase).minus(usedBase);

        // Update taker & maker filled quantities
        takerOrder.filled_quantity = usedBase
          .plus(takerOrder.filled_quantity)
          .toString();
        takerOrder.filled_quote_quantity = matchedQuoteQty
          .plus(takerOrder.filled_quote_quantity)
          .toString();

        makerOrder.filled_quantity = usedBase
          .plus(makerOrder.filled_quantity)
          .toString();
        makerOrder.filled_quote_quantity = matchedQuoteQty
          .plus(makerOrder.filled_quote_quantity)
          .toString();

        totalBaseFilled = totalBaseFilled.plus(usedBase);
        totalQuoteSpent = totalQuoteSpent.plus(matchedQuoteQty);

        if (
          new Decimal(makerOrder.filled_quantity).greaterThanOrEqualTo(
            makerOrder.quantity,
          )
        ) {
          makerOrder.status = OrderStatus.FILLED;
          await this.redisOrderBookService.deleteOrder(
            makerOrder.market_token.symbol,
            oppositeSide,
            makerOrder.id,
            makerOrder.price,
            makerOrder.user.id,
          );
        } else {
          makerOrder.status = OrderStatus.PARTIALLY_FILLED;
          await this.redisOrderBookService.updateOrder(
            makerOrder.market_token.symbol,
            oppositeSide,
            makerOrder.id,
            makerOrder.price,
            makerOrder,
          );
        }
        this.toCreateOrders.push(makerOrder);

        await this.pushToBalanceAndLedger(
          makerOrder.user.id,
          oppositeSide,
          order.walletType,
          market_token.baseToken.asset,
          market_token.quoteToken.asset,
          matchedQuoteQty.toString(),
          usedBase.toString(),
          price,
        );

        // add candle into redis
        for (const interval of timeFrameCandles) {
          await this.redisCandleService.updateCandle(
            market_token.symbol,
            interval,
            price,
            usedBase.toString(),
            dayjs().valueOf(),
          );
        }

        await this.balance_lotFifo.pushToBalanceLot(
          takerOrder.side,
          takerOrder.user.id,
          order.walletType,
          market_token.baseToken.asset,
          market_token.quoteToken.asset,
          new Decimal(price),
          usedBase,
        );

        await this.balance_lotFifo.pushToBalanceLot(
          makerOrder.side,
          makerOrder.user.id,
          order.walletType,
          market_token.baseToken.asset,
          market_token.quoteToken.asset,
          new Decimal(price),
          usedBase,
        );

        await this.updateTicker(
          new Decimal(price),
          usedBase,
          matchedQuoteQty,
          market_token,
        );

        this.trades.push({
          price,
          quantity: usedBase.toString(),
          quote_quantity: matchedQuoteQty.toString(),
          taker_order: this.orderRepo.create(takerOrder),
          maker_order: this.orderRepo.create(makerOrder),
          market_token: this.marketTokenRepo.create(market_token),
          tradeTime: dayjs().valueOf(),
        });

        if (remainBase.lessThanOrEqualTo(0)) break;
      }
      if (remainBase.lessThanOrEqualTo(0)) break;
    }

    takerOrder.avg_price = totalBaseFilled.greaterThan(0)
      ? totalQuoteSpent
          .div(totalBaseFilled)
          .toDecimalPlaces(8, Decimal.ROUND_DOWN)
          .toString()
      : '0';
    // Final status
    if (remainBase.lessThanOrEqualTo(0)) {
      takerOrder.status = OrderStatus.FILLED;
      await this.pushToBalanceAndLedger(
        takerOrder.user.id,
        order.side,
        order.walletType,
        market_token.baseToken.asset,
        market_token.quoteToken.asset,
        totalQuoteSpent.toString(),
        totalBaseFilled.toString(),
        takerOrder.avg_price,
      );
    } else if (new Decimal(takerOrder.filled_quantity).greaterThan(0)) {
      takerOrder.status = OrderStatus.PARTIALLY_FILLED;
      const remain =
        takerOrder.side === OrderSide.BUY
          ? remainBase
          : Number(takerOrder.quantity) - Number(takerOrder.filled_quantity);
      await this.handleReimberForOrderPartial(
        takerOrder.user.id,
        order.side,
        order.walletType,
        market_token.baseToken.asset,
        market_token.quoteToken.asset,
        totalQuoteSpent.toString(),
        totalBaseFilled.toString(),
        remain.toString(),
        takerOrder.avg_price,
      );
    } else {
      takerOrder.status = OrderStatus.CANCELLED;

      await this.cancelOrder(
        takerOrder.user.id,
        order.side,
        order.walletType,
        market_token.baseToken.asset,
        market_token.quoteToken.asset,
        remainBase.toString(),
      );
      await this.redisService.publish(
        SpotEvent.OrderCancelled,
        JSON.stringify(takerOrder),
      );
    }

    this.toCreateOrders.push(takerOrder);
  }

  async cancelOrder(
    user_id: string,
    side: OrderSide,
    walletType: walletType,
    _baseAsset: string,
    _quoteAsset: string,
    quantityAsset: string,
  ) {
    const user = await this.userRepo.findById(user_id);
    const [baseAssetBalan, quoteAssetBalan] = await Promise.all([
      this.balanceService.getBalances(user, _baseAsset, walletType),
      this.balanceService.getBalances(user, _quoteAsset, walletType),
    ]);

    if (
      side === OrderSide.BUY &&
      new Decimal(quoteAssetBalan.locked).greaterThan(0)
    ) {
      quoteAssetBalan.available = new Decimal(quoteAssetBalan.available)
        .plus(quantityAsset)
        .toString();
      quoteAssetBalan.locked = new Decimal(quoteAssetBalan.locked)
        .sub(quantityAsset)
        .toString();
    }

    if (
      side === OrderSide.SELL &&
      new Decimal(baseAssetBalan.locked).greaterThan(0)
    ) {
      baseAssetBalan.available = new Decimal(baseAssetBalan.available)
        .plus(quantityAsset)
        .toDecimalPlaces(8, Decimal.ROUND_DOWN)
        .toString();

      baseAssetBalan.locked = new Decimal(baseAssetBalan.locked)
        .sub(quantityAsset)
        .toDecimalPlaces(8, Decimal.ROUND_DOWN)
        .toString();
    }
    this.balances.push(baseAssetBalan, quoteAssetBalan);
  }

  async handleReimberForOrderPartial(
    user_id: string,
    side: OrderSide,
    walletType: walletType,
    _baseAsset: string,
    _quoteAsset: string,
    usedQuote: string,
    usedBase: string,
    remainAsset: string,
    price: string,
  ) {
    const user = await this.userRepo.findById(user_id);
    const [baseAssetBalan, quoteAssetBalan, wallet, tokenBase, tokenQuote] =
      await Promise.all([
        this.balanceService.getBalances(user, _baseAsset, walletType),
        this.balanceService.getBalances(user, _quoteAsset, walletType),
        this.walletSe.getWallet(walletType, user),
        this.tokenService.findByAsset(_baseAsset),
        this.tokenService.findByAsset(_quoteAsset),
      ]);
    let quoteLedgerDelta = new Decimal(0);
    let quoteLedgerReason: LedgerReason | null = null;

    let baseLedgerDelta = new Decimal(0);
    let baseLedgerReason: LedgerReason | null = null;

    if (
      side === OrderSide.BUY &&
      new Decimal(quoteAssetBalan.locked).greaterThan(0)
    ) {
      quoteAssetBalan.available = new Decimal(quoteAssetBalan.available)
        .plus(remainAsset)
        .toDecimalPlaces(8, Decimal.ROUND_DOWN)
        .toString();
      quoteAssetBalan.locked = new Decimal(quoteAssetBalan.locked)
        .sub(new Decimal(usedQuote).plus(remainAsset))
        .toDecimalPlaces(8, Decimal.ROUND_DOWN)
        .toString();

      quoteLedgerDelta = quoteLedgerDelta.minus(usedQuote);

      quoteLedgerReason = LedgerReason.SELL;

      baseAssetBalan.available = new Decimal(baseAssetBalan.available)
        .plus(usedBase)
        .toDecimalPlaces(8, Decimal.ROUND_DOWN)
        .toString();

      baseLedgerDelta = baseLedgerDelta.plus(usedBase);

      baseLedgerReason = LedgerReason.BUY;
    }

    if (
      side === OrderSide.SELL &&
      new Decimal(baseAssetBalan.locked).greaterThan(0)
    ) {
      baseAssetBalan.available = new Decimal(baseAssetBalan.available)
        .plus(remainAsset)
        .toDecimalPlaces(8, Decimal.ROUND_DOWN)
        .toString();

      baseAssetBalan.locked = new Decimal(baseAssetBalan.locked)
        .sub(new Decimal(usedBase).plus(remainAsset))
        .toDecimalPlaces(8, Decimal.ROUND_DOWN)
        .toString();

      baseLedgerDelta = baseLedgerDelta.minus(usedBase);

      baseLedgerReason = LedgerReason.SELL;

      quoteAssetBalan.available = new Decimal(quoteAssetBalan.available)
        .plus(usedQuote)
        .toDecimalPlaces(8, Decimal.ROUND_DOWN)
        .toString();

      quoteLedgerDelta = quoteLedgerDelta.plus(usedQuote);

      quoteLedgerReason = LedgerReason.BUY;
    }
    this.balances.push(baseAssetBalan, quoteAssetBalan);
    if (baseLedgerReason && quoteLedgerReason) {
      this.ledgers.push(
        {
          token: tokenBase,
          user,
          delta: baseLedgerDelta.toString(),
          reason: baseLedgerReason,
          description: descriptionType.SUCCESSFUL,
          priceUsdt: price,
        },
        {
          token: tokenQuote,
          user,
          delta: quoteLedgerDelta.toString(),
          reason: quoteLedgerReason,
          description: descriptionType.SUCCESSFUL,
          priceUsdt: '1',
        },
      );

      baseLedgerDelta = new Decimal(0);
      baseLedgerReason = null;
      quoteLedgerDelta = new Decimal(0);
      quoteLedgerReason = null;
    }
  }

  async pushToBalanceAndLedger(
    user_id: string,
    side: OrderSide,
    walletType: walletType,
    _baseAsset: string,
    _quoteAsset: string,
    usedQuote: string,
    usedBase: string,
    price: string,
  ) {
    const user = await this.userRepo.findById(user_id);
    const [baseAssetBalan, quoteAssetBalan, wallet, tokenBase, tokenQuote] =
      await Promise.all([
        this.balanceService.getBalances(user, _baseAsset, walletType),
        this.balanceService.getBalances(user, _quoteAsset, walletType),
        this.walletSe.getWallet(walletType, user),
        this.tokenService.findByAsset(_baseAsset),
        this.tokenService.findByAsset(_quoteAsset),
      ]);

    let quoteLedgerDelta = new Decimal(0);
    let quoteLedgerReason: LedgerReason | null = null;

    let baseLedgerDelta = new Decimal(0);
    let baseLedgerReason: LedgerReason | null = null;

    const hasCache =
      this.balanceAssetBaseForUser &&
      this.balanceAssetQuoteForUser &&
      baseAssetBalan.id === this.balanceAssetBaseForUser.id &&
      quoteAssetBalan.id === this.balanceAssetQuoteForUser.id;

    if (!hasCache) {
      this.balanceAssetBaseForUser = baseAssetBalan;
      this.balanceAssetQuoteForUser = quoteAssetBalan;
    }

    if (side === OrderSide.BUY) {
      this.balanceAssetQuoteForUser!.locked = new Decimal(
        this.balanceAssetQuoteForUser!.locked,
      )
        .sub(usedQuote)
        .toDecimalPlaces(8, Decimal.ROUND_DOWN)
        .toString();

      this.balanceAssetBaseForUser!.available = new Decimal(
        this.balanceAssetBaseForUser!.available,
      )
        .plus(usedBase)
        .toDecimalPlaces(8, Decimal.ROUND_DOWN)
        .toString();

      quoteLedgerDelta = quoteLedgerDelta.sub(usedQuote);

      quoteLedgerReason = LedgerReason.SELL;

      baseLedgerDelta = baseLedgerDelta.plus(usedBase);

      baseLedgerReason = LedgerReason.BUY;
    } else {
      this.balanceAssetBaseForUser!.locked = new Decimal(
        this.balanceAssetBaseForUser!.locked,
      )
        .sub(usedBase)
        .toDecimalPlaces(8, Decimal.ROUND_DOWN)
        .toString();

      this.balanceAssetQuoteForUser!.available = new Decimal(
        this.balanceAssetQuoteForUser!.available,
      )
        .plus(usedQuote)
        .toDecimalPlaces(8, Decimal.ROUND_DOWN)
        .toString();

      baseLedgerDelta = baseLedgerDelta.sub(usedBase);
      baseLedgerReason = LedgerReason.SELL;

      quoteLedgerDelta = quoteLedgerDelta.plus(usedQuote);
      quoteLedgerReason = LedgerReason.BUY;
    }
    this.balances.push(
      this.balanceAssetBaseForUser!,
      this.balanceAssetQuoteForUser!,
    );
    if (baseLedgerReason && quoteLedgerReason) {
      this.ledgers.push(
        {
          token: tokenBase,
          user,
          delta: baseLedgerDelta.toString(),
          reason: baseLedgerReason,
          description: descriptionType.SUCCESSFUL,
          priceUsdt: price,
        },
        {
          token: tokenQuote,
          user,
          delta: quoteLedgerDelta.toString(),
          reason: quoteLedgerReason,
          description: descriptionType.SUCCESSFUL,
          priceUsdt: '1',
        },
      );

      baseLedgerDelta = new Decimal(0);
      baseLedgerReason = null;
      quoteLedgerDelta = new Decimal(0);
      quoteLedgerReason = null;
    }
  }

  async handleWriteToDB(): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(OrderEntity);
      const tradeRepo = manager.getRepository(TradeEntity);
      const balanceRepo = manager.getRepository(BalanceEntity);
      const ledgerRepo = manager.getRepository(LedgerEntity);
      const balance_lotRepo = manager.getRepository(BalanceLotEntity);
      const pnlRepo = manager.getRepository(RealizedPnlEntity);

      await orderRepo.save(orderRepo.create(this.toCreateOrders));
      await Promise.all([
        tradeRepo.save(tradeRepo.create(this.trades)),
        ledgerRepo.save(ledgerRepo.create(this.ledgers)),
        this.balance_lotFifo.commitAll(balance_lotRepo, pnlRepo),
      ]);

      const balanceSave = await balanceRepo.save(
        balanceRepo.create(this.balances),
      );

      const balanceIds = balanceSave.map((b) => b.id);
      const getbalanceSave = await balanceRepo.find({
        where: { id: In(balanceIds) },
        relations: ['wallet', 'token'],
      });

      for (const balance of getbalanceSave) {
        const key = this.balance_lotFifo.makeKey(
          balance.wallet.id,
          balance.token.asset,
        );
        const avgNew = this.balance_lotFifo.snapshots.get(key)?.avgPrice;
        const costNew = this.balance_lotFifo.snapshots.get(key)?.costPrice;

        balance.avgPrice = avgNew ? avgNew.toString() : '0';
        balance.costPrice = costNew ? costNew.toString() : '0';
      }

      // console.log('balanceSave: ', balanceSave);

      await balanceRepo.save(getbalanceSave);

      // console.log('toCreate: ', orderRepo.create(this.toCreateOrders));
      // console.log('trades: ', tradeRepo.create(this.trades));
      console.log('balances : ', balanceRepo.create(this.balances));
      // console.log('ledgers: ', ledgerRepo.create(this.ledgers));
    });
  }

  resetCatch() {
    this.toCreateOrders.length = 0;
    this.trades.length = 0;
    this.balances.length = 0;
    this.ledgers.length = 0;
    this.balanceAssetBaseForUser = null;
    this.balanceAssetQuoteForUser = null;
  }

  async updateTicker(
    _price: Decimal,
    _basequantity: Decimal,
    _quoteQuantity: Decimal,
    market_token: MarketTokenEntity,
  ) {
    const dayNow = dayjs().toDate();

    const ticker_old = await this.redisTickerService.getTicker(
      market_token.symbol,
    );
    const price = _price.toDecimalPlaces(2);

    const basequantity = _basequantity.toDecimalPlaces(2);
    const quoteQuantity = _quoteQuantity.toDecimalPlaces(2);

    let ticker: tickerRedis;
    let isTickerNew = false;

    if (!ticker_old) {
      ticker = {
        symbol: market_token.symbol,
        lastPrice: price.toString(),
        highPrice: price.toString(),
        lowPrice: price.toString(),
        openPrice: price.toString(),
        baseVolume: basequantity.toString(),
        quoteVolume: quoteQuantity.toString(),
        priceChangePercent: '0',
        updatedAt: dayNow,
      };
      isTickerNew = true;
    } else {
      const openPrice = new Decimal(ticker_old.openPrice);
      const oldHigh = new Decimal(ticker_old.highPrice);
      const oldLow = new Decimal(ticker_old.lowPrice);
      const oldBaseVol = new Decimal(ticker_old.baseVolume);
      const oldQuoteVol = new Decimal(ticker_old.quoteVolume);

      ticker = {
        symbol: market_token.symbol,
        lastPrice: price.toString(),
        highPrice: Decimal.max(oldHigh, price).toString(),
        lowPrice: Decimal.min(oldLow, price).toString(),
        openPrice: openPrice.toString(),
        baseVolume: oldBaseVol.plus(basequantity).toString(),
        quoteVolume: oldQuoteVol.plus(quoteQuantity).toString(),
        priceChangePercent: price
          .minus(openPrice)
          .div(openPrice)
          .times(100)
          .toDecimalPlaces(2)
          .toString(),
        updatedAt: dayNow,
      };
    }
    if (isTickerNew) {
      await this.tickerService.onModuleInit();
    }
    await this.redisTickerService.updateTicker(ticker);
  }
}
