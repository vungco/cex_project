import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { UserEntity } from '../entities';
import { TokenEntity } from '../entities/token.entity';
import {
  TransactionHistoryEntity,
  TransactionStatus,
  TransactionType,
} from '../entities/transaction-history.entity';
import { TransactionHistoryReposirory } from '../repositories/transaction-history.repository';

export interface EmitResponHistoryDto {
  user: UserEntity;
  networkId: string;
  token: TokenEntity;
  excuAddress: string;
  amount: string;
  txHash: string;
  status: TransactionStatus;
  type: TransactionType;
  fee: string;
}

/** Realtime rút: FE subscribe qua WebSocket cùng namespace `/spot` (auth JWT) */
export interface WithdrawalUpdatedEmitDto {
  type: 'WITHDRAWAL_UPDATED';
  withdrawalId: string;
  userId: string;
  networkId: string;
  status: TransactionStatus;
  txHash: string | null;
  amount: string;
  fee: string;
  toAddress: string;
  tokenId: string;
  tokenSymbol?: string;
  /** Ghép với `explorerUrl` từ DB network trên wallet nếu cần; MVP để null */
  explorerUrl: string | null;
}

@Injectable()
export class TransactionHistoryService {
  constructor(
    private readonly transactionHistoryRepository: TransactionHistoryReposirory,
  ) {}

  /**
   * Tạo transaction mới
   */
  async create(dto: EmitResponHistoryDto): Promise<TransactionHistoryEntity> {
    const tx = this.transactionHistoryRepository.create(dto);
    return await this.transactionHistoryRepository.save(tx);
  }

  async createWithManager(
    manager: EntityManager,
    dto: EmitResponHistoryDto,
  ): Promise<TransactionHistoryEntity> {
    const repo = manager.getRepository(TransactionHistoryEntity);
    const tx = repo.create(dto);
    return repo.save(tx);
  }

  async getAllByUser(user: UserEntity): Promise<TransactionHistoryEntity[]> {
    const txs = await this.transactionHistoryRepository.find({
      where: { user: { id: user.id } },
      relations: ['token'],
      order: { createdAt: 'DESC' },
    });
    if (!txs.length)
      throw new NotFoundException('No transaction history found');
    return txs;
  }

  /** Lấy lịch sử nạp tiền */
  async getDeposits(user: UserEntity): Promise<TransactionHistoryEntity[]> {
    return this.transactionHistoryRepository.find({
      where: { user: { id: user.id }, type: TransactionType.DEPOSIT },
      relations: ['token'],
      order: { createdAt: 'DESC' },
    });
  }

  /** Lấy lịch sử rút tiền */
  async getWithdrawals(user: UserEntity): Promise<TransactionHistoryEntity[]> {
    return this.transactionHistoryRepository.find({
      where: { user: { id: user.id }, type: TransactionType.WITHDRAWAL },
      relations: ['token'],
      order: { createdAt: 'DESC' },
    });
  }
}
