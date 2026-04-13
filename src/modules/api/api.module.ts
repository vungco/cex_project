import { Module } from '@nestjs/common';
import { AuthController } from './controller/auth.controller';
import { AuthService } from './services/auth.service';
import { DatabaseModule } from '../database/database.module';
import { JwtModule } from '@nestjs/jwt';
import { env } from 'src/utils';
import { BalanceController } from './controller/balance.controller';
import { OrderController } from './controller/order.controller';
import { TokenController } from './controller/token.controller';
import { MarketTokenController } from './controller/market-token.controller';
import { WalletController } from './controller/wallet.controller';
import { GatewayModule } from './gateways/gateway.module';
import { LedgerController } from './controller/ledger.controller';
import { TickerController } from './controller/ticker.controller';
import { WithdrawController } from './controller/withdraw.controller';
import { DepositWalletController } from './controller/deposit-wallet.controller';
import { TransactionHistoryController } from './controller/transaction-history.controller';
import { KafkaSubscriberService } from './services/kafka-subscriber.service';
import { WalletDepositKafkaHandler } from './services/deposit.service';
import { WalletDepositKafkaController } from './controller/wallet-deposit.kafka.controller';

const controllers = [
  AuthController,
  BalanceController,
  OrderController,
  TokenController,
  MarketTokenController,
  WalletController,
  LedgerController,
  TickerController,
  DepositWalletController,
  WithdrawController,
  TransactionHistoryController,
  WalletDepositKafkaController,
];
const services = [AuthService, KafkaSubscriberService, WalletDepositKafkaHandler];

@Module({
  imports: [
    DatabaseModule,
    JwtModule.register({
      global: true,
      secret: env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
    GatewayModule,
  ],
  controllers: [...controllers],
  providers: [...services],
})
export class ApiModule {}
