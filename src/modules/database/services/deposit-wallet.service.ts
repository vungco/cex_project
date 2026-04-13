import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { WalletService } from './wallet.service';
import { UserEntity, walletType } from '../entities';
import { UserRepository } from '../repositories';
import { TokenService } from './token.service';
import { DepositWalletEntity } from '../entities/deposit-wallet.entity';
import { DepositWalletRepository } from '../repositories/deposit-wallet.repository';

@Injectable()
export class DepositWalletService {
  constructor(
    private readonly depositRepo: DepositWalletRepository,
    private readonly walletSe: WalletService,
    private readonly userRepo: UserRepository,
    private readonly tokenService: TokenService,
  ) {}

  async getDeposit(
    user_id: string,
    token_id: string,
  ): Promise<DepositWalletEntity> {
    const user = await this.userRepo.findById(user_id);
    const wallet = await this.walletSe.getWallet(walletType.FUNDING, user);

    const token = await this.tokenService.findById(token_id);

    const tokenDeposit = await this.depositRepo.findOne({
      where: { token: { id: token_id }, wallet: { id: wallet.id } },
      relations: ['wallet'],
    });

    if (tokenDeposit) return tokenDeposit;

    const tokenDepoSave = await this.depositRepo.save(
      this.depositRepo.create({
        wallet,
        token,
      }),
    );

    if (!tokenDepoSave) {
      throw new InternalServerErrorException('error save');
    }

    return tokenDepoSave;
  }

  async getDepositWithManager(
    manager: EntityManager,
    user_id: string,
    token_id: string,
  ): Promise<DepositWalletEntity> {
    const user = await manager
      .getRepository(UserEntity)
      .findOne({ where: { id: user_id } });
    if (!user) {
      throw new InternalServerErrorException('user not found');
    }

    const wallet = await this.walletSe.getWallet(walletType.FUNDING, user);
    const token = await this.tokenService.findById(token_id);
    const depoRepo = manager.getRepository(DepositWalletEntity);

    const tokenDeposit = await depoRepo.findOne({
      where: { token: { id: token_id }, wallet: { id: wallet.id } },
      relations: ['wallet', 'wallet.user'],
    });

    if (tokenDeposit) return tokenDeposit;

    const tokenDepoSave = await depoRepo.save(
      depoRepo.create({
        wallet,
        token,
      }),
    );

    if (!tokenDepoSave) {
      throw new InternalServerErrorException('error save');
    }

    const withRelations = await depoRepo.findOne({
      where: { id: tokenDepoSave.id },
      relations: ['wallet', 'wallet.user'],
    });
    if (!withRelations) {
      throw new InternalServerErrorException('deposit row missing after save');
    }
    return withRelations;
  }
}
