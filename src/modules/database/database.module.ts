import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseConfig } from './configs';
import { BalanceEntity } from './entities/balance.entity';
import { LedgerEntity } from './entities/ledger.entity';
import { OrderEntity } from './entities/order.entity';
import { TradeEntity } from './entities/trade.entity';
import { UserEntity } from './entities/user.entity';
import { UserRepository } from './repositories/user.repository';
import { WalletEntity } from './entities/wallet.entity';
import { BalanceRepository } from './repositories/balance.repository';
import { LedgerRepository } from './repositories/ledger.repository';
import { OrderRepository } from './repositories/order.repository';
import { TradeRepository } from './repositories/trade.repository';
import { WalletRepository } from './repositories/wallet.repository';
import { UserService } from './services/user.service';
import { WalletService } from './services/wallet.service';
import { OrderService } from './services/order.service';
import { QueueModule } from '../queue/queue.module';
import { LedgerService } from './services/ledger.service';
import { BalanceService } from './services';
import { TokenEntity } from './entities/token.entity';
import { MarketTokenEntity } from './entities/market-token.entity';
import { MarketTokenRepository } from './repositories/market-token.repository';
import { MarketTokenService } from './services/market-token.service';
import {
  Candle1mRepository,
  TickerRepository,
  TokenRepository,
} from './repositories';
import { TokenService } from './services/token.service';
import {
  Candle15mEntity,
  Candle1mEntity,
  Candle5mEntity,
  TickerEntity,
} from './entities';
import { RedisModule } from '../redis/redis.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Candle1mService } from './services/candle1m.service';
import { TickerService } from './services/ticker.service';
import { Candle5mRepository } from './repositories/candle5m.repository';
import { Candle15mRepository } from './repositories/candle15m.repository';
import { Candle5mService } from './services/candle5m.service';
import { Candle15mService } from './services/candle15m.service';
import { BalanceLotEntity } from './entities/balane_lot.entity';
import { BalanceLotRepository } from './repositories/balance_lot.repository';
import { BalanceLotService } from './services/balance_lot.service';
import { Realized_pnl_historyRepository } from './repositories/realized_pnl_history.repository';
import { RealizedPnlEntity } from './entities/realized_pnl_history';
import { User_daily_pnlEntity } from './entities/user-daily-pnl.entity';
import { UserDailyPnlRepository } from './repositories/user-daily-pnl.repository';
import { UserDailyPnlService } from './services/user-daily-pnl.service';
import { WithdrawService } from './services/withdraw.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { env, parseKafkaBrokers } from 'src/utils';
import { DepositWalletEntity } from './entities/deposit-wallet.entity';
import { TransactionHistoryEntity } from './entities/transaction-history.entity';
import { DepositWalletRepository } from './repositories/deposit-wallet.repository';
import { TransactionHistoryReposirory } from './repositories/transaction-history.repository';
import { DepositWalletService } from './services/deposit-wallet.service';
import { TransactionHistoryService } from './services/transaction-history.service';
import { QueueProduceModule } from '../queue/queueProduce.module';

const entities = [
  BalanceEntity,
  LedgerEntity,
  OrderEntity,
  TradeEntity,
  UserEntity,
  WalletEntity,
  TokenEntity,
  MarketTokenEntity,
  Candle1mEntity,
  Candle5mEntity,
  Candle15mEntity,
  TickerEntity,
  BalanceLotEntity,
  RealizedPnlEntity,
  User_daily_pnlEntity,
  DepositWalletEntity,
  TransactionHistoryEntity,
];

const repositories = [
  UserRepository,
  BalanceRepository,
  LedgerRepository,
  OrderRepository,
  TradeRepository,
  WalletRepository,
  MarketTokenRepository,
  TokenRepository,
  Candle1mRepository,
  Candle5mRepository,
  Candle15mRepository,
  TickerRepository,
  BalanceLotRepository,
  Realized_pnl_historyRepository,
  UserDailyPnlRepository,
  DepositWalletRepository,
  TransactionHistoryReposirory,
];

const services = [
  UserService,
  WalletService,
  BalanceService,
  OrderService,
  LedgerService,
  MarketTokenService,
  TokenService,
  LedgerService,
  Candle1mService,
  Candle5mService,
  Candle15mService,
  TickerService,
  BalanceLotService,
  UserDailyPnlService,
  DepositWalletService,
  WithdrawService,
  TransactionHistoryService,
];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useClass: DatabaseConfig,
    }),
    TypeOrmModule.forFeature([...entities]),
    QueueProduceModule,
    RedisModule,
    EventEmitterModule.forRoot(),
    ClientsModule.register([
      {
        name: 'BLOCKCHAIN_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: {
            brokers: parseKafkaBrokers(env.KAFKA_BROKERS),
          },
          consumer: {
            groupId: 'blockchain',
          },
        },
      },
    ]),
  ],
  controllers: [],
  providers: [...repositories, ...services],
  exports: [...repositories, ...services, ClientsModule],
})
export class DatabaseModule {}
