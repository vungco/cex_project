import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { env } from 'src/utils';
import { WalletDepositKafkaHandler } from '../services/deposit.service';

@Controller()
export class WalletDepositKafkaController {
  private readonly logger = new Logger(WalletDepositKafkaController.name);

  constructor(private readonly handler: WalletDepositKafkaHandler) {}

  @EventPattern(env.KAFKA_WALLET_DEPOSIT_TOPIC)
  async onDeposit(@Payload() message: unknown) {
    try {
      await this.handler.handle(message);
    } catch (e) {
      this.logger.error(
        `wallet deposit kafka error: ${e instanceof Error ? e.message : String(e)}`,
      );
      throw e;
    }
  }
}
