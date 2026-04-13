import { Injectable, NotFoundException } from '@nestjs/common';
import { TokenRepository } from '../repositories';
import { TokenEntity } from '../entities/token.entity';
import { TokenCreateDto } from 'src/modules/api/dtos';

@Injectable()
export class TokenService {
  constructor(private readonly tokenRepository: TokenRepository) {}

  async getAll(): Promise<TokenEntity[]> {
    const tokens = await this.tokenRepository.find({
      order: { createdAt: 'DESC' },
    });

    if (!tokens) {
      throw new NotFoundException('tokens not found');
    }
    return tokens;
  }

  async createToken(body: TokenCreateDto): Promise<any> {
    const [existsingAsset, existingName] = await Promise.all([
      this.tokenRepository.findOne({ where: { asset: body.asset } }),
      this.tokenRepository.findOne({ where: { name: body.name } }),
    ]);
    if (existsingAsset) {
      return { success: false, message: 'Token asset already exists' };
    }
    if (existingName) {
      return { success: false, message: 'Token name already exists' };
    }

    const token = await this.tokenRepository.save(
      this.tokenRepository.create({ ...body }),
    );
    if (!token) {
      throw new Error('Token creation failed');
    }
    return { success: true, token };
  }

  async findByAsset(asset: string): Promise<TokenEntity> {
    const token = await this.tokenRepository.findOne({
      where: { asset },
    });

    if (!token) {
      throw new Error(`Token not found at asset ${asset}`);
    }
    return token;
  }

  async findByName(name: string): Promise<TokenEntity> {
    const token = await this.tokenRepository.findOne({
      where: { name },
    });

    if (!token) {
      throw new Error(`Token not found at name ${name}`);
    }
    return token;
  }

  async findById(token_id: string): Promise<TokenEntity> {
    const token = await this.tokenRepository.findOne({
      where: { id: token_id },
    });

    if (!token) {
      throw new Error(`Token not found at name ${name}`);
    }
    return token;
  }
}
