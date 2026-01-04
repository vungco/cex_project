import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { LedgerRepository, UserRepository } from '../repositories';
import {
  descriptionType,
  LedgerEntity,
  LedgerReason,
  UserEntity,
  walletType,
} from '../entities';
import { WalletService } from './wallet.service';
import { TokenService } from './token.service';
import { getAllLedgerDto } from 'src/modules/api/dtos';
import { TokenEntity } from '../entities/token.entity';
import { In } from 'typeorm';

@Injectable()
export class LedgerService {
  constructor(
    private readonly ledgerRepo: LedgerRepository,
    private readonly walletService: WalletService,
    private readonly userRepo: UserRepository,
    private readonly tokenService: TokenService,
  ) {}

  async getAll(
    user: UserEntity,
    query: getAllLedgerDto,
  ): Promise<LedgerEntity[]> {
    const { walletType, assetToken } = query;
    const wallet = await this.walletService.getWallet(walletType, user);
    const where: any = { user: { id: user.id } };
    if (assetToken) {
      const token = await this.tokenService.findByAsset(assetToken);
      where.token = { id: token.id };
    }
    const ledgersByWallets = await this.ledgerRepo.find({
      where,
      relations: ['user', 'token'],
      order: { createdAt: 'DESC' },
    });

    if (!ledgersByWallets || ledgersByWallets.length == 0) {
      throw new NotFoundException(`ledgers by wallet ${walletType} not found`);
    }

    return ledgersByWallets;
  }

  async getLedger(
    user_id: string,
    asset: string,
    walletType: walletType,
  ): Promise<LedgerEntity | null> {
    const user = await this.userRepo.findById(user_id);

    const token = await this.tokenService.findByAsset(asset);

    const ledger = await this.ledgerRepo.findOne({ where: { user, token } });

    return ledger;
  }

  async create(
    delta: string,
    price: string | null,
    reason: LedgerReason,
    token: TokenEntity,
    user: UserEntity,
  ): Promise<LedgerEntity> {
    const ledgerSave = await this.ledgerRepo.save(
      this.ledgerRepo.create({
        delta,
        priceUsdt: price,
        reason,
        token,
        user,
        description: descriptionType.SUCCESSFUL,
      }),
    );
    if (!ledgerSave) {
      throw new InternalServerErrorException('error while save ledger');
    }
    return ledgerSave;
  }

  async getLedgersForPnlCumu(token: TokenEntity): Promise<LedgerEntity[]> {
    const ledgers = await this.ledgerRepo.find({
      where: {
        reason: In([
          LedgerReason.CONVERT,
          LedgerReason.DEPOSIT,
          LedgerReason.WITHDRAW,
        ]),
        token: { id: token.id },
      },
    });

    if (!ledgers.length) {
      throw new NotFoundException('ledgers for cumu not found');
    }
    return ledgers;
  }
}
