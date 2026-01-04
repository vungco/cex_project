import { Injectable, NotFoundException } from '@nestjs/common';
import dayjs from 'dayjs';
import Decimal from 'decimal.js';
import {
  BalanceEntity,
  BalanceLotEntity,
  OrderSide,
  UserEntity,
  WalletEntity,
  walletType,
} from 'src/modules/database/entities';
import { RealizedPnlEntity } from 'src/modules/database/entities/realized_pnl_history';
import { TokenEntity } from 'src/modules/database/entities/token.entity';
import { UserRepository } from 'src/modules/database/repositories';
import { BalanceLotRepository } from 'src/modules/database/repositories/balance_lot.repository';
import { Realized_pnl_historyRepository } from 'src/modules/database/repositories/realized_pnl_history.repository';
import {
  BalanceService,
  TokenService,
  WalletService,
} from 'src/modules/database/services';
import { BalanceLotService } from 'src/modules/database/services/balance_lot.service';
import { RedisBaseService } from 'src/modules/redis/services/redis.base.service';
import { RedisTickerService } from 'src/modules/redis/services/redis.ticker.service';
import { Repository } from 'typeorm';

type SnapshotKey = string;

interface BalanceSnapshot {
  balance: BalanceEntity;
  lots: BalanceLotEntity[];
  avgPrice: Decimal; // giá trung bình hiện tại
  costPrice: Decimal; // giá vốn
}

@Injectable()
export class BalanceLotFifo {
  private toCreate: BalanceLotEntity[] = [];
  private toUpdate: BalanceLotEntity[] = [];
  private toDelete: BalanceLotEntity[] = [];
  private toCreatePnlHistory: RealizedPnlEntity[] = [];
  public snapshots: Map<SnapshotKey, BalanceSnapshot> = new Map();

  constructor(
    private readonly userRepo: UserRepository,
    private readonly tokenService: TokenService,
    private readonly walletService: WalletService,
    private readonly balanceLotService: BalanceLotService,
    private readonly balanceService: BalanceService,
    private readonly redisService: RedisBaseService,
    private readonly balanceLotRepo: BalanceLotRepository,
    private readonly PnlRepo: Realized_pnl_historyRepository,
    private readonly redisTickerService: RedisTickerService,
  ) {}

  public makeKey(walletId: string, baseAsset: string) {
    return `${walletId}:${baseAsset}`;
  }

  private async ensureSnapshot(
    wallet: WalletEntity,
    baseAsset: TokenEntity,
    user: UserEntity,
  ): Promise<BalanceSnapshot> {
    const key = this.makeKey(wallet.id, baseAsset.asset);
    if (this.snapshots.has(key)) return this.snapshots.get(key)!;

    const [lots, balance] = await Promise.all([
      this.balanceLotService.findAllByWallet(wallet, baseAsset),
      this.balanceService.getBalances(user, baseAsset.asset, wallet.type),
    ]);

    const snap: BalanceSnapshot = {
      balance,
      lots,
      avgPrice: new Decimal(0),
      costPrice: new Decimal(0),
    };
    snap.avgPrice = new Decimal(balance.avgPrice);

    this.snapshots.set(key, snap);

    return snap;
  }

  async pushToBalanceLot(
    side: OrderSide,
    userId: string,
    walletType: walletType,
    baseSymbol: string,
    quoteSymbol: string,
    price: Decimal,
    qty: Decimal,
  ) {
    const user = await this.userRepo.findById(userId);
    const wallet = await this.walletService.getWallet(walletType, user);
    const baseToken = await this.tokenService.findByAsset(baseSymbol);
    const snapshot = await this.ensureSnapshot(wallet, baseToken, user);

    const lotSnapshot = snapshot.lots;
    const balance = snapshot.balance;

    if (side === OrderSide.BUY) {
      // --- BUY: thêm lot mới ---
      let quoteToUsdt = new Decimal(1);
      if (quoteSymbol !== 'USDT') {
        const ticker = await this.redisTickerService.getTicker(
          `${baseSymbol}USDT`,
        );
        if (!ticker)
          throw new NotFoundException('Ticker not found for quote asset');
        quoteToUsdt = new Decimal(ticker.lastPrice);
      }

      const now = dayjs().toDate(); // chuyển về kiểu Date để tương thích entity TypeORM

      const newLot = this.balanceLotRepo.create({
        wallet,
        baseToken,
        quantity: qty.toString(),
        price: price.times(quoteToUsdt).toString(),
        createdAt: now,
        updatedAt: now,
      });

      lotSnapshot.push(newLot);
      this.toCreate.push(newLot);

      if (snapshot.lots.length === 0) {
        snapshot.avgPrice = price;
        snapshot.costPrice = price;
      } else {
        const totalQty = lotSnapshot.reduce(
          (acc, l) => acc.plus(new Decimal(l.quantity)),
          new Decimal(0),
        );
        const totalValue = lotSnapshot.reduce(
          (acc, l) =>
            acc.plus(new Decimal(l.quantity).times(new Decimal(l.price))),
          new Decimal(0),
        );

        snapshot.avgPrice = totalQty.gt(0)
          ? totalValue.div(totalQty)
          : new Decimal(0);
        snapshot.costPrice = totalQty.gt(0)
          ? snapshot.costPrice
              .times(new Decimal(balance.available).plus(balance.locked))
              .plus(price.times(qty))
              .div(
                new Decimal(balance.available).plus(balance.locked).plus(qty),
              )
          : new Decimal(0);
      }
    } else {
      // --- SELL: tiêu thụ FIFO ---
      let remain = new Decimal(qty);

      const lots = lotSnapshot;
      lots.sort(
        (a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0),
      );

      for (let i = 0; i < lots.length && remain.gt(0); ) {
        const lot = lots[i];
        const ticker = await this.redisTickerService.getTicker(
          `${baseSymbol}USDT`,
        );
        if (!ticker)
          throw new NotFoundException('Ticker not found for quote asset');

        const sellPrice = new Decimal(ticker.lastPrice);
        const lotQty = new Decimal(lot.quantity);
        const usedQty = Decimal.min(lotQty, remain);
        const newLotQty = lotQty.minus(usedQty);

        const realizedPnl = sellPrice
          .minus(new Decimal(lot.price))
          .times(usedQty);
        let realizedPnlPercent: string | null = sellPrice
          .minus(new Decimal(lot.price))
          .div(new Decimal(lot.price))
          .times(100)
          .toString();
        if (!new Decimal(realizedPnlPercent).isZero()) {
          realizedPnlPercent = null;
        }

        // Lưu lịch sử PnL
        this.toCreatePnlHistory.push(
          this.PnlRepo.create({
            baseToken,
            realized_pnl: realizedPnl.toString(), // lời/lỗ tuyệt đối
            realized_pnl_percent: realizedPnlPercent, // %
            sell_price: sellPrice.toString(),
            lot_price: lot.price,
            quantity: usedQty.toString(),
            createdAt: new Date(),
          }),
        );

        if (newLotQty.lte(0)) {
          // xoá luôn khỏi snapshot
          this.toDelete.push(lot);
          lotSnapshot.splice(i, 1);
        } else {
          // update quantity tại chỗ
          lotSnapshot[i].quantity = newLotQty.toString();
          this.toUpdate.push(lot);
          i++;
        }

        remain = remain.minus(usedQty);
      }

      if (lotSnapshot.length == 0) {
        snapshot.avgPrice = new Decimal(0);
        snapshot.costPrice = new Decimal(0);
      }
    }
  }

  getResult() {
    return {
      toCreate: this.toCreate,
      toUpdate: this.toUpdate,
      toDelete: this.toDelete,
      snapshots: this.snapshots,
    };
  }

  async commitAll(
    managerBalance_lot: Repository<BalanceLotEntity>,
    managerPnl: Repository<RealizedPnlEntity>,
  ) {
    if (this.toDelete.length) {
      await managerBalance_lot.remove(this.toDelete);
    }
    if (this.toUpdate.length) {
      await managerBalance_lot.save(this.toUpdate);
    }
    if (this.toCreate.length) {
      await managerBalance_lot.save(this.toCreate);
    }
    if (this.toCreatePnlHistory.length) {
      await managerPnl.save(this.toCreatePnlHistory);
    }
  }

  resetAll(): void {
    this.toCreate = [];
    this.toUpdate = [];
    this.toDelete = [];
    this.snapshots.clear();
  }
}
