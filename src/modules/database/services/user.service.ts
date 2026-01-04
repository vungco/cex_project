import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { UserRepository } from '../repositories/user.repository';
import { UserEntity, UserRole } from '../entities';
import { env } from 'process';

@Injectable()
export class UserService implements OnModuleInit {
  private readonly logger = new Logger(UserService.name);
  constructor(private readonly userRepo: UserRepository) {}

  onModuleInit() {
    this.seedAdmin();
  }

  async seedAdmin(): Promise<UserEntity> {
    const existsAdmin = await this.userRepo.findOne({
      where: { role: 'admin' },
    });

    if (existsAdmin) {
      this.logger.warn('Admin user already exists, skipping seeding.');
      return existsAdmin;
    }
    const admin = await this.userRepo.save(
      this.userRepo.create({
        email: env.emailAdmin,
        password: env.passwordAdmin,
        role: env.roleAdmin === 'admin' ? UserRole.ADMIN : UserRole.USER,
      }),
    );

    if (!admin) {
      throw new InternalServerErrorException('Failed to create admin user');
    }
    this.logger.warn(`Admin user created with email: ${admin.email}`);
    return admin;
  }

  async findByEmail(email: string): Promise<UserEntity> {
    const user = await this.userRepo.findOne({
      where: { email: email },
    });
    if (!user) {
      throw new InternalServerErrorException('User not found');
    }
    return user;
  }
}
