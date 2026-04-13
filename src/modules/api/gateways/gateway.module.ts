import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SpotPublicGateway } from './spotPublic.gateway';
import { RedisModule } from 'src/modules/redis/redis.module';
import { DatabaseModule } from 'src/modules/database/database.module';
import { env } from 'process';

@Module({
  imports: [
    JwtModule.register({
      secret: env.JWT_SECRET,
    }),
    RedisModule,
    DatabaseModule,
  ],
  providers: [SpotPublicGateway],
  exports: [SpotPublicGateway],
})
export class GatewayModule {}
