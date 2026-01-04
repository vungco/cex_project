import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserEntity } from 'src/modules/database/entities/user.entity';
import { AuthResponseDto, LoginDto, RegisterDto } from '../dtos/auth.dto';
import { DataSource } from 'typeorm';
import { InitWallets } from 'src/shared/constans';
import { UserRepository } from 'src/modules/database/repositories/user.repository';
import { WalletEntity } from 'src/modules/database/entities';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly userRepo: UserRepository,
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
  ) {}

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = dto;
    const user = await this.userRepo.findOne({ where: { email, password } });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    const payload = { userId: user.id, email: user.email, role: user.role };
    const token = await this.jwtService.signAsync(payload);
    return { access_token: token, user };
  }

  async register(dto: RegisterDto): Promise<{ sucess: boolean }> {
    const { email, password } = dto;

    const exists = await this.userRepo.findOne({ where: { email } });
    if (exists) {
      throw new Error('User already exists');
    }

    return this.dataSource.transaction(async (manager) => {
      const userRepository = manager.getRepository(UserEntity);
      const walletRepository = manager.getRepository(WalletEntity);

      // 1. save account wallet
      const user = await userRepository.save(
        userRepository.create({ email, password }),
      );

      // 2. add default wallet
      await walletRepository.save(
        InitWallets.map((wallet) =>
          walletRepository.create({
            ...wallet,
            user,
          }),
        ),
      );
      return { sucess: true };
    });
  }
}
