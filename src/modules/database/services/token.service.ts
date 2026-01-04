import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { TokenRepository } from '../repositories';
import { assetDefault, TokenEntity } from '../entities/token.entity';
import { TokenCreateDto } from 'src/modules/api/dtos';
import { DEFAULT_ASSET } from 'src/shared/constans';

@Injectable()
export class TokenService implements OnModuleInit {
  private readonly logger = new Logger(TokenService.name);
  constructor(private readonly tokenRepository: TokenRepository) {}

  async onModuleInit() {
    await this.initTokenUsdt();
  }

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

  async initTokenUsdt(): Promise<TokenEntity> {
    const existsingAsset = await this.tokenRepository.findOne({
      where: { asset: assetDefault },
    });
    if (existsingAsset) {
      this.logger.warn('token already exists skipping seeding.');
      return existsingAsset;
    }

    const token = await this.tokenRepository.save(
      this.tokenRepository.create({
        asset: DEFAULT_ASSET,
        name: DEFAULT_ASSET,
      }),
    );

    if (!token) {
      throw new InternalServerErrorException('failed to create token');
    }
    this.logger.warn(`token ${token.asset} created`);
    return token;
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
