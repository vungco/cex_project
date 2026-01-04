import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { BalanceLotRepository } from '../repositories/balance_lot.repository';
import { BalanceLotEntity, WalletEntity } from '../entities';
import { TokenEntity } from '../entities/token.entity';
import Decimal from 'decimal.js';
import { EntityManager, Repository } from 'typeorm';

@Injectable()
export class BalanceLotService {
  constructor(private readonly balance_lotRepo: BalanceLotRepository) {}

  async findAllByWallet(
    wallet: WalletEntity,
    baseToken: TokenEntity,
  ): Promise<BalanceLotEntity[]> {
    const balance_lots = await this.balance_lotRepo.find({
      where: { wallet: { id: wallet.id }, baseToken: { id: baseToken.id } },
      order: { createdAt: 'ASC' },
    });

    if (!balance_lots) {
      throw new NotFoundException('balance_lots not found');
    }

    return balance_lots;
  }

  async caculatorAvg(
    wallet: WalletEntity,
    baseToken: TokenEntity,
    manager?: Repository<BalanceLotEntity>,
  ): Promise<{
    totalQuantity: Decimal;
    totalPrice: Decimal;
  }> {
    const repo = manager ? manager : this.balance_lotRepo;

    const balance_lots = await repo.find({
      where: {
        wallet: { id: wallet.id },
        baseToken: { id: baseToken.id },
      },
    });

    let totalQuantity = new Decimal(0);
    let totalPrice = new Decimal(0);

    for (const lot of balance_lots) {
      const qty = new Decimal(lot.quantity || 0);
      const price = new Decimal(lot.price || 0);

      totalQuantity = totalQuantity.plus(qty);
      totalPrice = totalPrice.plus(qty.times(price));
    }

    return {
      totalQuantity: totalQuantity,
      totalPrice: totalPrice,
    };
  }

  async createAll(balance_lots: BalanceLotEntity[]) {
    const balance_lotSave = await this.balance_lotRepo.save(balance_lots);
    if (!balance_lotSave) {
      throw new InternalServerErrorException('error for save balance_lot');
    }
    return balance_lotSave;
  }

  async createforTradeMatch(
    baseToken: TokenEntity,
    quantity: string,
    price: string,
  ): Promise<BalanceLotEntity> {
    const ba_lot = await this.balance_lotRepo.save({
      baseToken,
      quantity,
      price,
    });
    if (!ba_lot) {
      throw new InternalServerErrorException('error save one ba_lot');
    }
    return ba_lot;
  }

  async deleteAll(balance_lots: BalanceLotEntity[]) {
    for (const lot of balance_lots) {
      const balance_lotSave = await this.balance_lotRepo.delete(lot);
      if (!balance_lotSave) {
        throw new InternalServerErrorException('error for save balance_lot');
      }
    }
  }

  async deductBalanceLotsAtomic(
    balanceLotRepo: Repository<BalanceLotEntity>,
    baseToken: TokenEntity,
    wallet: WalletEntity,
    amount: string,
  ): Promise<void> {
    const lotsAll = await balanceLotRepo.find({
      where: {
        wallet: { id: wallet.id },
        baseToken: { id: baseToken.id },
      },
      order: { createdAt: 'DESC' },
    });

    if (!lotsAll || lotsAll.length === 0) {
      throw new NotFoundException('No balance lots found for this wallet');
    }

    const total = lotsAll.reduce(
      (acc, l) => acc.plus(l.quantity),
      new Decimal(0),
    );
    const need = new Decimal(amount);

    if (total.lessThan(need)) {
      throw new BadRequestException(
        `Insufficient lots balance: required ${need.toString()}, available ${total.toString()}`,
      );
    }

    await balanceLotRepo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(BalanceLotEntity);
      let remain = new Decimal(amount);

      const lots = await repo.find({
        where: {
          wallet: { id: wallet.id },
          baseToken: { id: baseToken.id },
        },
        order: { createdAt: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });

      const totalAgain = lots.reduce(
        (acc, l) => acc.plus(l.quantity),
        new Decimal(0),
      );
      if (totalAgain.equals(need)) {
        await repo.remove(lots);
        return;
      }

      for (const lot of lots) {
        if (remain.lte(0)) break;

        const lotQty = new Decimal(lot.quantity);

        if (lotQty.greaterThanOrEqualTo(remain)) {
          const newQty = lotQty.minus(remain);
          lot.quantity = newQty.toString();

          if (newQty.equals(0)) {
            await repo.remove(lot);
          } else {
            await repo.save(lot);
          }

          remain = new Decimal(0);
          break;
        } else {
          remain = remain.minus(lotQty);
          await repo.remove(lot);
        }
      }

      if (remain.greaterThan(0)) {
        throw new BadRequestException(
          `Unexpected insufficient after deduction: ${remain.toString()}`,
        );
      }
    });
  }
}
