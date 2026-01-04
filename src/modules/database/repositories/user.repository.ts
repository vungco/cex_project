import { Injectable, NotFoundException } from '@nestjs/common';
import { UserEntity } from '../entities/user.entity';
import { DataSource, Repository } from 'typeorm';

@Injectable()
export class UserRepository extends Repository<UserEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(UserEntity, dataSource.createEntityManager());
  }

  async findByEmail(email: string): Promise<UserEntity> {
    const user = await this.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException('user not found');
    }
    return user;
  }

  async findById(id: string): Promise<UserEntity> {
    const user = await this.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('user not found');
    }
    return user;
  }
}
