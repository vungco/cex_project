import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { BalanceEntity } from '../entities/balance.entity';
import {
  BalacneDtoCreate,
  ResponseDetailTokenDto,
} from 'src/modules/api/dtos/balance.dto';
import { DataSource, EntityManager } from 'typeorm';
import {
  BalanceLotEntity,
  descriptionType,
  LedgerEntity,
  LedgerReason,
  lotType,
  OrderSide,
  OrderType,
  UserEntity,
  WalletEntity,
  walletType,
} from '../entities';
import { UserRepository } from '../repositories/user.repository';
import { OrderDtoCreate } from 'src/modules/api/dtos';
import { BalanceRepository } from '../repositories';
import { InjectDataSource } from '@nestjs/typeorm';
import { TokenService } from './token.service';
import { WalletService } from './wallet.service';
import { MarketTokenService } from './market-token.service';
import Decimal from 'decimal.js';
import { DEFAULT_ASSET } from 'src/shared/constans';
import { TokenEntity } from '../entities/token.entity';
import { LedgerService } from './ledger.service';
import { RedisOrderBookService } from 'src/modules/redis/services/redis.orderbook.service';
import { RedisTickerService } from 'src/modules/redis/services/redis.ticker.service';

@Injectable()
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);
  @InjectDataSource()
  private readonly dataSource: DataSource;
  constructor(
    private readonly userRepo: UserRepository,
    private readonly balanceRepo: BalanceRepository,
    private readonly tokenService: TokenService,
    private readonly ledgerSer: LedgerService,
    private readonly walletSe: WalletService,
    private readonly marketTokenService: MarketTokenService,
    private readonly redisOrderBookService: RedisOrderBookService,
    private readonly redisTickerService: RedisTickerService,
  ) {}

  async depositToken(
    wallet: WalletEntity,
    token_id: string,
    amount: string,
    user_id: string,
  ) {
    const user = await this.userRepo.findById(user_id);
    const token = await this.tokenService.findById(token_id);

    return this.dataSource.transaction(async (mananger) => {
      const balanceRepo = mananger.getRepository(BalanceEntity);
      const ledgerRepo = mananger.getRepository(LedgerEntity);
      const balance_lot = mananger.getRepository(BalanceLotEntity);

      await balanceRepo.query(
        `
        INSERT INTO balances (token_id, wallet_id, available, locked)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (token_id, wallet_id)
        DO UPDATE SET available = balances.available + EXCLUDED.available
        `,
        [token.id, wallet.id, amount, 0],
      );

      let ledgerCreate = {};
      if (token.asset === DEFAULT_ASSET) {
        ledgerCreate = ledgerRepo.create({
          token: token,
          delta: amount,
          reason: LedgerReason.DEPOSIT,
          user,
          description: descriptionType.SUCCESSFUL,
        });
      } else {
        ledgerCreate = ledgerRepo.create({
          token: token,
          delta: amount,
          priceUsdt: '0',
          reason: LedgerReason.DEPOSIT,
          user,
          description: descriptionType.SUCCESSFUL,
        });

        await balance_lot.save(
          balance_lot.create({
            baseToken: token,
            quantity: amount,
            price: '0',
            type: lotType.CONVERT,
            wallet,
          }),
        );
      }
      await ledgerRepo.save(ledgerCreate);

      return { success: true };
    });
  }

  async create(body: BalacneDtoCreate): Promise<{
    success: boolean;
  }> {
    const { user_email, asset, available, typeWallet } = body;

    const user = await this.userRepo.findByEmail(user_email);
    const [token, wallet] = await Promise.all([
      this.tokenService.findByAsset(asset),
      this.walletSe.getWallet(typeWallet, user),
    ]);

    return this.dataSource.transaction(async (mananger) => {
      const balanceRepo = mananger.getRepository(BalanceEntity);
      const ledgerRepo = mananger.getRepository(LedgerEntity);
      const balance_lot = mananger.getRepository(BalanceLotEntity);

      await balanceRepo.query(
        `
        INSERT INTO balances (token_id, wallet_id, available, locked)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (token_id, wallet_id)
        DO UPDATE SET available = balances.available + EXCLUDED.available
        `,
        [token.id, wallet.id, available, 0],
      );

      let ledgerCreate = {};
      if (token.asset === DEFAULT_ASSET) {
        ledgerCreate = ledgerRepo.create({
          token: token,
          delta: available,
          reason: LedgerReason.DEPOSIT,
          user,
          description: descriptionType.SUCCESSFUL,
        });
      } else {
        ledgerCreate = ledgerRepo.create({
          token: token,
          delta: available,
          priceUsdt: '0',
          reason: LedgerReason.DEPOSIT,
          user,
          description: descriptionType.SUCCESSFUL,
        });

        await balance_lot.save(
          balance_lot.create({
            baseToken: token,
            quantity: available,
            price: '0',
            type: lotType.CONVERT,
            wallet,
          }),
        );
      }
      await ledgerRepo.save(ledgerCreate);

      return { success: true };
    });
  }

  async getBalances(
    user: UserEntity,
    asset: string,
    walletType: walletType,
    manager?: EntityManager,
  ): Promise<BalanceEntity> {
    const balanceRepo = manager
      ? manager.getRepository(BalanceEntity)
      : this.balanceRepo;

    const [token, wallet] = await Promise.all([
      this.tokenService.findByAsset(asset),
      this.walletSe.getWallet(walletType, user),
    ]);

    await balanceRepo
      .createQueryBuilder()
      .insert()
      .into(BalanceEntity)
      .values({
        token,
        wallet,
        available: '0',
        locked: '0',
      })
      .orIgnore()
      .execute();

    const balances = await balanceRepo.findOne({
      where: { token: { id: token.id }, wallet: { id: wallet.id } },
    });

    if (!balances) {
      throw new NotFoundException('Balance not found after creation');
    }

    return balances;
  }

  async lockBalance(
    user: UserEntity,
    asset: string,
    quantity: string,
    walletType: walletType,
  ): Promise<void> {
    const balance = await this.getBalances(user, asset, walletType);
    if (new Decimal(balance.available).lessThan(quantity)) {
      throw new NotFoundException('Insufficient balance availabe for lock');
    }
    balance.available = new Decimal(balance.available)
      .minus(quantity)
      .toDecimalPlaces(8, Decimal.ROUND_DOWN)
      .toString();
    balance.locked = new Decimal(balance.locked)
      .plus(quantity)
      .toDecimalPlaces(8, Decimal.ROUND_DOWN)
      .toString();

    await this.balanceRepo.save(balance);
  }

  async checkBalance(
    order: OrderDtoCreate,
    user_id: string,
  ): Promise<{ error: boolean; message?: string }> {
    //check redis order :
    if (order.type == OrderType.MARKET) {
      const oppositeSide =
        order.side === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY;

      const orderbook = await this.redisOrderBookService.getOrderBook(
        order.symbol,
        oppositeSide,
      );

      if (!orderbook.length) {
        this.logger.error(`oppositeSide ${oppositeSide} not long enouge`);
        return {
          error: true,
          message: `oppositeSide ${oppositeSide} not long enouge`,
        };
      }
    }

    // reci order => baseAsset
    const walletType = order.walletType;
    const marketToken = await this.marketTokenService.findByName(order.symbol);

    // const totalPrice = new Decimal(order.price)
    //   .times(order.quantity)
    //   .toDecimalPlaces(8, Decimal.ROUND_DOWN);

    const user = await this.userRepo.findById(user_id);

    if (order.side === OrderSide.BUY) {
      await this.ensureAssetExists(
        user_id,
        marketToken.quoteToken.asset,
        walletType,
      );

      const balanceBy = await this.getBalances(
        user,
        marketToken.quoteToken.asset,
        order.walletType,
      );

      if (new Decimal(balanceBy.available).lessThan(order.quote_quantity)) {
        return { error: true, message: 'Insufficient balance for buy order' };
      }
    }
    if (order.side === OrderSide.SELL) {
      await this.ensureAssetExists(
        user_id,
        marketToken.baseToken.asset,
        walletType,
      );

      const balanceSell = await this.getBalances(
        user,
        marketToken.baseToken.asset,
        order.walletType,
      );

      if (new Decimal(balanceSell.available).lessThan(order.quantity)) {
        return { error: true, message: 'Insufficient balance for sell order' };
      }
    }

    await this.lockBalance(
      user,
      order.side === OrderSide.BUY
        ? marketToken.quoteToken.asset
        : marketToken.baseToken.asset,
      order.side === OrderSide.BUY
        ? order.quote_quantity.toString()
        : order.quantity.toString(),
      walletType,
    );
    return {
      error: false,
    };
  }

  async ensureAssetExists(
    user_id: string,
    asset: string,
    walletType: walletType,
  ): Promise<void> {
    const user = await this.userRepo.findById(user_id);
    const [token, wallet] = await Promise.all([
      this.tokenService.findByAsset(asset),
      this.walletSe.getWallet(walletType, user),
    ]);

    const existsAsset = await this.balanceRepo.findOne({
      where: { token: { id: token.id }, wallet: { id: wallet.id } },
    });
    if (!existsAsset)
      throw new NotFoundException(
        `Asset ${asset} not found By ${walletType} please deposit and transfer from funding to spot`,
      );
  }

  async updateAvgToken(balance: BalanceEntity): Promise<void> {
    await this.balanceRepo.save(balance);
  }

  async getPnlTokenBalanceSpot(
    user: UserEntity,
  ): Promise<{ balance: Partial<BalanceEntity>; pnl?: string | null }[]> {
    // show all token balance
    const wallet = await this.walletSe.getWallet(walletType.SPOT, user);
    const balances = await this.balanceRepo.find({
      where: { wallet: { id: wallet.id } },
      relations: ['token'],
    });

    const result: { balance: Partial<BalanceEntity>; pnl?: string | null }[] =
      [];
    for (const balance of balances) {
      if (balance.token.asset === DEFAULT_ASSET) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { avgPrice, costPrice, ...rest } = balance;
        result.push({
          balance: rest,
        });
        continue;
      }
      const tickertoUsdt = await this.redisTickerService.getTicker(
        `${balance.token.asset}${DEFAULT_ASSET}`,
      );

      if (!tickertoUsdt) {
        throw new InternalServerErrorException(
          `ticker for ${balance.token.asset}${DEFAULT_ASSET} not found`,
        );
      }
      let pnl: string | null = new Decimal(tickertoUsdt.lastPrice)
        .minus(tickertoUsdt.openPrice)
        .div(tickertoUsdt.openPrice)
        .times(100)
        .toString();

      if (!pnl) {
        pnl = null;
      }
      result.push({
        balance,
        pnl,
      });
    }
    return result;
  }

  async getAllBalanceByAsset(baseToken: TokenEntity) {
    const balances = await this.balanceRepo.find({
      where: { token: { id: baseToken.id } },
    });
    if (!balances) {
      throw new NotFoundException(`balances for baseToken not found`);
    }
    return balances;
  }

  async getDetailPnlTokenBalance(
    asset: string,
    user: UserEntity,
  ): Promise<ResponseDetailTokenDto> {
    if (asset === DEFAULT_ASSET) {
      throw new InternalServerErrorException('asset usdt not get detail');
    }

    const balance = await this.getBalances(user, asset, walletType.SPOT);

    const ticker = await this.redisTickerService.getTicker(
      `${asset}${DEFAULT_ASSET}`,
    );
    if (!ticker) {
      throw new NotFoundException(`ticker ${asset}${DEFAULT_ASSET} not found`);
    }
    const totalQty = new Decimal(balance.available).plus(balance.locked);
    const totalToUsdt = totalQty.times(ticker.lastPrice);

    const daily_pnlPercent = new Decimal(ticker.lastPrice)
      .minus(ticker.openPrice)
      .div(ticker.openPrice)
      .times(100)
      .toString();
    const daily_pnl = new Decimal(ticker.lastPrice)
      .minus(ticker.openPrice)
      .times(totalQty)
      .toString();

    const cost_pnlPercent = new Decimal(ticker.lastPrice)
      .minus(balance.costPrice)
      .div(balance.costPrice)
      .times(100)
      .toString();
    const cost_pnl = new Decimal(ticker.lastPrice)
      .minus(balance.costPrice)
      .times(totalQty)
      .toString();

    const cumulative_pnl = await this.caculaterCumulative_pnl(
      asset,
      totalToUsdt,
    );
    const cumulative_pnlPercent = await this.caculaterCumulative_pnlPecent(
      new Decimal(cumulative_pnl),
      asset,
    );

    return {
      symbol: ticker.symbol,
      daily_pnlPercent,
      daily_pnl,
      cost_pnlPercent,
      cost_pnl,
      cumulative_pnlPercent,
      cumulative_pnl,
      avgPrice: balance.avgPrice,
      costPrice: balance.costPrice,
      marketPrice: ticker.lastPrice,
    };
  }

  async getChartTokenBalance() {}

  async caculaterCumulative_pnl(
    asset: string,
    totalPriceUsdt: Decimal,
  ): Promise<string> {
    const token = await this.tokenService.findByAsset(asset);
    const ledgers = await this.ledgerSer.getLedgersForPnlCumu(token);
    const totalSpent = this.caculaTotalSpent(ledgers);
    return totalPriceUsdt.minus(totalSpent).toString();
  }

  async caculaterCumulative_pnlPecent(
    pnl: Decimal,
    asset: string,
  ): Promise<string> {
    const token = await this.tokenService.findByAsset(asset);
    const ledgers = await this.ledgerSer.getLedgersForPnlCumu(token);
    const totalSpent = this.caculaTotalSpent(ledgers);
    return pnl.div(totalSpent).toString();
  }

  caculaTotalSpent(ledgers: LedgerEntity[]): string {
    let totalSpent = new Decimal(0);
    for (const ledger of ledgers) {
      if (ledger.priceUsdt) {
        const priceUsdt = new Decimal(ledger.delta).times(ledger.priceUsdt);
        totalSpent = totalSpent.plus(priceUsdt);
      }
    }

    return totalSpent.toString();
  }
}
