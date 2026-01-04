import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { WalletRepository } from '../repositories/wallet.repository';
import { DEFAULT_ASSET, InitWallets } from 'src/shared/constans';
import {
  BalanceEntity,
  BalanceLotEntity,
  descriptionType,
  LedgerEntity,
  LedgerReason,
  lotType,
  UserEntity,
  WalletEntity,
  walletType,
} from '../entities';
import { BalanceRepository } from '../repositories';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { TokenEntity } from '../entities/token.entity';
import Decimal from 'decimal.js';
import { BalanceLotService } from './balance_lot.service';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly balanceRepository: BalanceRepository,
    private readonly dataSource: DataSource,
    private readonly balanceLotService: BalanceLotService,
  ) {}

  async handleInitWallets(user: UserEntity): Promise<WalletEntity[]> {
    const wallets = await this.walletRepository.find({ where: { user } });

    const existsWallets = new Set(
      wallets.map((wallet) => wallet.type.toLowerCase()),
    );
    const toCreate = InitWallets.filter(
      (wallet) => !existsWallets.has(wallet.type.toLowerCase()),
    );

    if (toCreate.length === 0) {
      return wallets;
    }

    const finalwallets = await this.walletRepository.save(
      toCreate.map((wallet) =>
        this.walletRepository.create({
          ...wallet,
          user,
        }),
      ),
    );
    if (finalwallets.length == 0) {
      throw new Error('Failed to create wallets');
    }
    return finalwallets;
  }

  async getWallet(type: walletType, user: UserEntity): Promise<WalletEntity> {
    const wallet = await this.walletRepository.findOne({
      where: { type, user: { id: user.id } },
    });

    if (!wallet) throw new Error('Wallet not found');
    return wallet;
  }

  async getBalanceByWallet(
    type: walletType,
    user: UserEntity,
  ): Promise<BalanceEntity[]> {
    const wallet = await this.walletRepository.findOne({
      where: { type, user: { id: user.id } },
    });

    if (!wallet) throw new Error('Wallet not found');

    // // tìm trong bảng balance có wallet_id = wallet.id ko
    const balances = await this.balanceRepository.find({
      where: { wallet: { id: wallet.id } },
      relations: ['token'],
    });
    if (!balances) {
      this.logger.warn(
        `No  balance found for wallet ID: ${wallet.id}. Returning zero balance object.`,
      );
    }
    return balances;
  }

  async getAllWallets(): Promise<WalletEntity[]> {
    const wallets = await this.walletRepository.find();
    if (!wallets || wallets.length === 0) throw new Error('No wallets found');
    return wallets;
  }

  async transferFunds(
    user: UserEntity,
    fromWalletType: walletType,
    toWalletType: walletType,
    amount: string,
    assetToken: string,
  ): Promise<{ success: boolean; message: string }> {
    if (new Decimal(amount).lessThan(0)) {
      throw new InternalServerErrorException('amount not less than 0');
    }

    return this.dataSource.transaction(async (manager: EntityManager) => {
      const walletRepo = manager.getRepository(WalletEntity);
      const balanceRepo = manager.getRepository(BalanceEntity);
      const ledgerRepo = manager.getRepository(LedgerEntity);
      const tokenRepo = manager.getRepository(TokenEntity);
      const balance_lotRepo = manager.getRepository(BalanceLotEntity);

      const [fromWallet, toWallet] = await Promise.all([
        walletRepo.findOne({
          where: { user: { id: user.id }, type: fromWalletType },
        }),
        walletRepo.findOne({
          where: { user: { id: user.id }, type: toWalletType },
        }),
      ]);

      if (!fromWallet || !toWallet) {
        throw new NotFoundException('One or both wallets not found.');
      }

      const token = await tokenRepo.findOne({ where: { asset: assetToken } });
      if (!token) {
        throw new NotFoundException(
          `Token with symbol ${assetToken} not found.`,
        );
      }
      const fromBalance = await balanceRepo.findOne({
        where: { wallet: { id: fromWallet.id }, token: { id: token.id } },
      });

      if (!fromBalance) {
        throw new BadRequestException(
          `The source wallet does not have any balance for the token ${assetToken}.`,
        );
      }
      if (new Decimal(fromBalance.available).lessThan(amount)) {
        throw new BadRequestException(
          `Insufficient available balance in the source wallet for the token ${assetToken}.`,
        );
      }

      fromBalance.available = new Decimal(fromBalance.available)
        .minus(amount)
        .toString();

      let toBalance = await balanceRepo
        .createQueryBuilder('balance')
        .setLock('pessimistic_write')
        .where('balance.wallet_id = :walletId', { walletId: toWallet.id })
        .andWhere('balance.token_id = :tokenId', { tokenId: token.id })
        .getOne();

      if (!toBalance) {
        toBalance = balanceRepo.create({
          wallet: toWallet,
          token: token,
          available: amount,
          locked: '0',
        });
      } else {
        toBalance.available = new Decimal(toBalance.available)
          .plus(amount)
          .toString();
      }

      const description = this.getDescriptionType(fromWalletType, toWalletType);

      if (token.asset !== DEFAULT_ASSET) {
        await this.convertBalanceLot(
          balance_lotRepo,
          token,
          fromWallet,
          toWallet,
          amount,
        );

        const totalqtyPriceFromWallet =
          await this.balanceLotService.caculatorAvg(
            fromWallet,
            token,
            balance_lotRepo,
          );
        fromBalance.avgPrice = totalqtyPriceFromWallet.totalQuantity.equals(0)
          ? '0'
          : totalqtyPriceFromWallet.totalPrice
              .div(totalqtyPriceFromWallet.totalQuantity)
              .toString();

        const totalqtyPriceToWallet = await this.balanceLotService.caculatorAvg(
          toWallet,
          token,
          balance_lotRepo,
        );

        toBalance.avgPrice = totalqtyPriceToWallet.totalQuantity.equals(0)
          ? '0'
          : totalqtyPriceToWallet.totalPrice
              .div(totalqtyPriceToWallet.totalQuantity)
              .toString();
      }

      await Promise.all([
        balanceRepo.save(fromBalance),
        balanceRepo.save(toBalance),
        ledgerRepo.save(
          ledgerRepo.create({
            user: user,
            delta: new Decimal(amount).toString(),
            token: token,
            reason: LedgerReason.TRANSFERMONEY,
            description,
          }),
        ),
      ]);

      return {
        success: true,
        message: `Successfully transferred ${amount}-${token.asset} from ${fromWalletType} to ${toWalletType}.`,
      };
    });
  }

  getDescriptionType(from: walletType, to: walletType): descriptionType {
    if (from == walletType.SPOT) {
      return to == walletType.FUNDING
        ? descriptionType.SPOTFUNDING
        : descriptionType.SPOTFUTURE;
    }
    if (from == walletType.FUNDING) {
      return to == walletType.SPOT
        ? descriptionType.FUNGDINGSPOT
        : descriptionType.FUNGDINGFUTURE;
    }
    if (from == walletType.FUTURE) {
      return to == walletType.SPOT
        ? descriptionType.FUNGDINGSPOT
        : descriptionType.FUTUREFUNGDING;
    }

    throw new InternalServerErrorException('error while get descriptionType');
  }

  async convertBalanceLot(
    balance_lot: Repository<BalanceLotEntity>,
    baseToken: TokenEntity,
    fromWallet: WalletEntity,
    toWallet: WalletEntity,
    amount: string,
  ): Promise<void> {
    const lots = await balance_lot.find({
      where: {
        wallet: { id: fromWallet.id },
        baseToken: { id: baseToken.id },
      },
      order: { createdAt: 'DESC' },
    });

    if (!lots) throw new NotFoundException('lots not found');

    let remain = new Decimal(amount);
    const lotlistNew: Partial<BalanceLotEntity>[] = [];
    for (const lot of lots) {
      const spentLot = Decimal.min(remain, lot.quantity);
      remain = remain.minus(spentLot);
      lot.quantity = new Decimal(lot.quantity).minus(spentLot).toString();

      if (remain.equals(0)) {
        if (new Decimal(lot.quantity).equals(0)) {
          await balance_lot.remove(lot);
        } else {
          await balance_lot.save(lot);
        }

        const lotNew = {
          baseToken: baseToken,
          quantity: spentLot.toString(),
          price: lot.price,
          wallet: toWallet,
          type: lotType.CONVERT,
        };
        lotlistNew.push(lotNew);

        break;
      } else {
        await balance_lot.remove(lot);
        const lotNew = {
          baseToken: baseToken,
          quantity: spentLot.toString(),
          price: lot.price,
          wallet: toWallet,
          type: lotType.CONVERT,
        };
        lotlistNew.push(lotNew);
      }
    }

    await balance_lot.save(lotlistNew);
  }
}
