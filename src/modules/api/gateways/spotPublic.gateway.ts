import {
  BadRequestException,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  UseGuards,
} from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { DepositEvent, MarketEvent, SpotEvent } from 'src/shared/enums/enum';
import { WsAuth } from './ws-auth.guard';
import EventEmitter2, { Listener } from 'eventemitter2';
import { CandleData, tickerRedis, timeFrameCandles } from 'src/shared/constans';
import { MarketTokenService } from 'src/modules/database/services';
import { Candle1mService } from 'src/modules/database/services/candle1m.service';
import { TickerData } from './utils/spotPublic';
import { OrderEntity, TradeEntity } from 'src/modules/database/entities';
import { Candle5mService } from 'src/modules/database/services/candle5m.service';
import { Candle15mService } from 'src/modules/database/services/candle15m.service';
import { BaseCandleEntity } from 'src/modules/database/entities/candles/baseCandle.entity';
import { sumaryTicker } from 'src/modules/redis/constans/redis';
import { JwtService } from '@nestjs/jwt';
import { RedisBaseService } from 'src/modules/redis/services/redis.base.service';
import { RedisOrderBookService } from 'src/modules/redis/services/redis.orderbook.service';
import { RedisCandleService } from 'src/modules/redis/services/redis.candle.service';
import { RedisTickerService } from 'src/modules/redis/services/redis.ticker.service';
import { EmitResponHistoryDto } from 'src/modules/database/services/transaction-history.service';

interface JoinRoomData {
  symbol: string;
}

interface SubTimeframe {
  interval: string;
}

interface InitCandle {
  interval: string;
  symbol: string;
}

@WebSocketGateway({
  cors: { origin: '*' },
  pingInterval: 40000,
  pingTimeout: 60000,
  namespace: '/spot',
})
@UseGuards(WsAuth)
export class SpotPublicGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SpotPublicGateway.name);

  private clients: Map<string, Socket> = new Map();
  private clientRoom: Map<string, string> = new Map();
  private roomClients: Map<string, Set<string>> = new Map();
  private roomTimeframes: Map<string, Set<string>> = new Map();
  private roomTimeframeClients: Map<string, Set<string>> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private eventListeners: Listener[] = [];

  private readonly DEFAULT_DEPTH = 20;
  private readonly DEFAULT_INTERVAL = 1000; // ms

  constructor(
    private readonly redisService: RedisBaseService,
    private readonly redisOrderBookService: RedisOrderBookService,
    private readonly redisCandleService: RedisCandleService,
    private readonly redisTickerService: RedisTickerService,
    private readonly eventEmitter: EventEmitter2,
    private readonly marketTokenService: MarketTokenService,
    private readonly jwtService: JwtService,
    private readonly candle1mService: Candle1mService,
    private readonly candle5mService: Candle5mService,
    private readonly candle15mService: Candle15mService,
  ) {}

  async onModuleInit() {
    this.logger.log('✅ SpotPublicGateway initialized');
    const marketTokens = await this.marketTokenService.getAll();

    for (const mt of marketTokens) {
      if (!mt.isActive) continue;
      this.createMarketRoom(mt.symbol);
    }

    this.subTradeMatch();
    this.subCandles();
    this.subTicker();
    this.subCancelOrder();

    this.eventListeners.push(
      // this.eventEmitter.on(MarketEvent.CREATE, (symbol: string) => {
      //   this.createMarketRoom(symbol);
      // }) as Listener,

      this.eventEmitter.on(MarketEvent.ACTIVE, (symbol: string) => {
        this.createMarketRoom(symbol);
        this.subTicker();
        this.subCandles();
      }) as Listener,

      this.eventEmitter.on(
        SpotEvent.TickerBatch,
        (data: Record<string, sumaryTicker>) => {
          this.broadcastTickerSumary(data);
        },
      ) as Listener,

      this.eventEmitter.on(
        DepositEvent.CREATE,
        (data: EmitResponHistoryDto) => {
          this.broadDepositCreate(data);
        },
      ) as Listener,
    );
  }

  private subCancelOrder() {
    this.redisService.subscribe(SpotEvent.OrderCancelled, (message: string) => {
      try {
        const data: OrderEntity = JSON.parse(message);
        this.broadcastOrderCancel(data);
        // this.logger.log('📡 Subscribed to Redis channel: trade.match');
      } catch (err) {
        this.logger.error(`Error parsing trade.match event: ${err.message}`);
      }
    });
  }

  private subTradeMatch() {
    this.redisService.subscribe(SpotEvent.TradeMatch, (message: string) => {
      try {
        const data = JSON.parse(message);
        this.broadcastTradeMatch(data);
        // this.logger.log('📡 Subscribed to Redis channel: trade.match');
      } catch (err) {
        this.logger.error(`Error parsing trade.match event: ${err.message}`);
      }
    });
  }

  eventSubCandle(roomName: string, interval: string) {
    return `channel:candle:${roomName}:${interval}`;
  }

  subCandles() {
    for (const room of this.roomClients.keys()) {
      for (const interval of timeFrameCandles) {
        this.redisService.subscribe(
          this.eventSubCandle(room, interval),
          (message: string) => {
            try {
              const data = JSON.parse(message);
              this.broadcastCandles(room, interval, data);
            } catch (err) {
              this.logger.error(
                `Error parsing trade.match event: ${err.message}`,
              );
            }
          },
        );
      }
    }
  }

  eventSubTicker(roomName: string) {
    return `channel:ticker:${roomName}`;
  }

  subTicker() {
    for (const room of this.roomClients.keys()) {
      this.redisService.subscribe(
        this.eventSubTicker(room),
        (message: string) => {
          try {
            const data = JSON.parse(message);
            this.broadcastTicker(room, data);
            // this.logger.warn('📡 Subscribed to Redis channel: spot_ticker');
          } catch (err) {
            this.logger.error(
              `Error parsing spot:ticker event: ${err.message}`,
            );
          }
        },
      );
    }
  }

  private createMarketRoom(symbol: string) {
    if (this.roomClients.has(symbol)) return;
    this.roomClients.set(symbol, new Set());
    this.roomTimeframes.set(symbol, new Set(timeFrameCandles));
    this.logger.log(`Created WS room for market: ${symbol}`);
  }

  handleConnection(socket: Socket) {
    try {
      const token =
        socket.handshake.auth.token || socket.handshake.headers.authorization;

      if (!token) {
        socket.disconnect();
        this.logger.log(`🔴 Client disconnected: ${socket.id}`);
        return;
      }

      const payload = this.jwtService.verify(token);

      if (!payload) {
        socket.disconnect();
        return;
      }
      const user_id = payload.userId;
      if (!user_id) {
        socket.disconnect();
        return;
      }

      this.clients.set(user_id, socket);
      this.logger.log(`🟢 Client connected: ${user_id}`);
    } catch (error) {
      socket.disconnect();
      this.logger.log(`🔴 catch Client disconnected: ${socket.id}`, error);
    }
  }

  handleDisconnect(socket: Socket): void {
    const user_id = socket.handshake.auth.userId;

    if (user_id) {
      const room = this.clientRoom.get(user_id);
      if (room) {
        const clients = this.roomClients.get(room);
        if (clients) {
          clients.delete(user_id);
        }
        this.clientRoom.delete(user_id);
      }

      this.clients.delete(user_id);
      this.logger.log(`🔴 Client disconnected: ${user_id}`);
    }
  }

  onModuleDestroy() {
    this.intervals.forEach((interval) => clearInterval(interval));
    this.eventEmitter.removeAllListeners();
    this.eventListeners = [];
    this.logger.log('🧹 SpotPublicGateway destroyed');
  }

  @SubscribeMessage(SpotEvent.JoinRoom)
  async handleJoinRoom(
    @MessageBody() data: JoinRoomData,
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    const user_id = socket.handshake.auth.userId;

    if (user_id) {
      const symbol = data.symbol.toUpperCase();
      const room = symbol;

      if (!this.roomClients.has(room)) {
        return;
      }

      this.logger.log(`📥 Client ${user_id} joining ${room}`);

      this.clientRoom.set(user_id, room);

      this.roomClients.get(room)!.add(user_id);

      if (!this.intervals.has(room)) {
        const timer = setInterval(() => {
          this.updateOrderbook(room, symbol).catch((err) => {
            this.logger.error(
              `Error updating orderbook for ${room}: ${err.message}`,
            );
          });
        }, this.DEFAULT_INTERVAL);

        this.intervals.set(room, timer);
      }

      const snapshotOrderbook =
        await this.redisOrderBookService.getPublicOrderBook(
          symbol,
          this.DEFAULT_DEPTH,
        );

      const snapshotTicker = await this.redisTickerService.getTicker(symbol);
      if (snapshotTicker) {
        socket.emit(
          SpotEvent.TickerSnapshot,
          this.convertTicker(snapshotTicker),
        );
      }
      socket.emit(SpotEvent.OrderbookUpdate, snapshotOrderbook);
    }
  }

  @SubscribeMessage(SpotEvent.LeaveRoom)
  handleLeaveRoom(@ConnectedSocket() socket: Socket) {
    const user_id = socket.handshake.auth.userId;

    if (user_id) {
      const room = this.clientRoom.get(user_id);
      if (!room) return;

      const clients = this.roomClients.get(room);
      if (clients) {
        clients.delete(user_id);
      }

      this.clientRoom.delete(user_id);
      this.logger.log(`📤 Client ${user_id} left room ${room}`);
    }
  }

  @SubscribeMessage(SpotEvent.JoinTimeframe)
  handleSubTimeFrame(
    @MessageBody() data: SubTimeframe,
    @ConnectedSocket() socket: Socket,
  ) {
    const user_id = socket.handshake.auth.userId;

    if (user_id) {
      if (!this.clientRoom.has(user_id)) return;

      const symbol = this.clientRoom.get(user_id);
      if (!symbol) return;
      this.logger.warn('join Timeframe');

      const { interval } = data;
      const existsInterval = this.roomTimeframes.get(symbol)?.has(interval);
      if (!existsInterval) return;
      const room = `${symbol}:${interval}`;

      if (!this.roomTimeframeClients.has(room)) {
        this.roomTimeframeClients.set(room, new Set());
      }

      const client = this.roomTimeframeClients.get(room)?.has(user_id);

      if (client) return;

      this.roomTimeframeClients.get(room)!.add(user_id);
    }
  }

  @SubscribeMessage(SpotEvent.LeaveTimeframe)
  handleUnSubTimeFrame(
    @MessageBody() data: SubTimeframe,
    @ConnectedSocket() socket: Socket,
  ) {
    const user_id = socket.handshake.auth.userId;

    if (user_id) {
      const symbol = this.clientRoom.get(user_id);
      if (!symbol) return;
      const { interval } = data;
      this.logger.warn(`unsub Timeframe ${interval}`);
      const existsInterval = this.roomTimeframes.get(symbol)?.has(interval);
      if (!existsInterval) return;
      const room = `${symbol}:${interval}`;

      if (!this.roomTimeframeClients.has(room)) {
        return;
      }

      const client = this.roomTimeframeClients.get(room)?.has(user_id);

      if (!client) return;

      this.roomTimeframeClients.get(room)?.delete(user_id);
    }
  }

  @SubscribeMessage(SpotEvent.InitCandle)
  async handleInitCandle(
    @MessageBody() data: InitCandle,
    @ConnectedSocket() socket: Socket,
  ) {
    const user_id = socket.handshake.auth.userId;

    if (user_id) {
      if (!this.clientRoom.has(user_id)) return;

      const { interval, symbol } = data;
      if (this.roomClients.has(symbol)) {
        this.logger.warn(`init candle for ${user_id}`);

        let candles: BaseCandleEntity[] = [];
        if (interval === '1m') {
          candles = await this.candle1mService.findAllBySymbol(symbol);
        }
        if (interval === '5m') {
          candles = await this.candle5mService.findAllBySymbol(symbol);
        }
        if (interval === '15m') {
          candles = await this.candle15mService.findAllBySymbol(symbol);
        }

        const candleRedis = await this.redisCandleService.getCandle(
          symbol,
          interval,
        );

        socket.emit(SpotEvent.InitCandle, candles);
        socket.emit(SpotEvent.Timeframe, candleRedis);
      }
    }
  }

  @SubscribeMessage(SpotEvent.INITTICKER)
  async handleInitTicker(
    @MessageBody() data: InitCandle,
    @ConnectedSocket() socket: Socket,
  ) {
    const user_id = socket.handshake.auth.userId;

    if (user_id) {
      const { symbol } = data;
      const existsSymbol = this.clientRoom.get(user_id);

      if (!existsSymbol || existsSymbol != symbol) {
        throw new BadRequestException('symbol not clientroom');
      }

      const tickerRedis = await this.redisTickerService.getTicker(symbol);

      socket.emit(SpotEvent.INITTICKER, tickerRedis);
    }
  }

  /**
   * send trade.match for client on sub
   */
  private broadcastCandles(symbol: string, interval: string, data: CandleData) {
    const room = `${symbol}:${interval}`;
    const clients = this.roomTimeframeClients.get(room);
    if (!clients) return;

    for (const clientId of clients) {
      const client = this.clients.get(clientId);
      if (client) {
        client.emit(SpotEvent.Timeframe, data);
      }
    }
  }

  private broadcastTradeMatch(data: { symbol: string; trades: TradeEntity[] }) {
    const { symbol, trades } = data;

    const room = `${symbol}`;
    const clients = this.roomClients.get(room);
    if (!clients) return;
    const userIds = new Set<string>();

    for (const trade of trades) {
      if (trade.taker_order.user.id) userIds.add(trade.taker_order.user.id);
      if (trade.maker_order.user.id) userIds.add(trade.maker_order.user.id);
    }

    for (const clientId of clients) {
      const client = this.clients.get(clientId);
      if (client) {
        client.emit(SpotEvent.TradeMatch, Array.from(userIds));
      }
    }

    this.logger.warn(
      `📊 Broadcasted trade.match for ${symbol} to ${clients?.size || 0} clients`,
    );
  }

  private broadcastOrderCancel(order: OrderEntity) {
    const room = `${order.market_token.symbol}`;
    const clients = this.roomClients.get(room);
    if (!clients) return;
    for (const clientId of clients) {
      const client = this.clients.get(clientId);
      if (client) {
        client.emit(SpotEvent.OrderCancelled, order);
      }
    }

    this.logger.warn(
      `📊 Broadcasted order:cancelOrder for to ${clients?.size || 0} clients`,
    );
  }

  private async updateOrderbook(room: string, symbol: string): Promise<void> {
    const orderbook = await this.redisOrderBookService.getPublicOrderBook(
      symbol,
      this.DEFAULT_DEPTH,
    );
    const clients = this.roomClients.get(room);
    if (!clients) return;

    for (const clientId of clients) {
      const client = this.clients.get(clientId);
      if (client) {
        // console.log('orderbook ws:', orderbook);

        client.emit(SpotEvent.OrderbookUpdate, orderbook);
      }
    }
  }

  private broadcastTicker(symbol: string, data: tickerRedis) {
    const room = `${symbol}`;
    const clients = this.roomClients.get(room);
    if (!clients) return;
    const ticker = this.convertTicker(data);

    for (const clientId of clients) {
      const client = this.clients.get(clientId);
      if (client) {
        client.emit(SpotEvent.Ticker, ticker);
      }
    }
  }

  private broadcastTickerSumary(data: Record<string, sumaryTicker>) {
    for (const socket of this.clients.values()) {
      socket.emit(SpotEvent.TickerBatch, data);
    }
  }

  private broadDepositCreate(data: EmitResponHistoryDto) {
    const user_id = data.user.id;
    if (this.clients.has(user_id)) {
      const socket = this.clients.get(user_id);
      if (socket) {
        socket.emit(`${DepositEvent.CREATE}:${user_id}`, data);
      }
    }
  }

  private convertTicker(data: tickerRedis) {
    const ticker: TickerData = {
      pair: data.symbol,
      lastPrice: data.lastPrice,
      changePercent: data.priceChangePercent,
      high24h: data.highPrice,
      low24h: data.lowPrice,
      volumeBase: data.baseVolume,
      volumeQuote: data.quoteVolume,
    };

    return ticker;
  }
}
