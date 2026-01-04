import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class KafkaSubscriberService implements OnModuleInit {
  constructor(
    @Inject('BLOCKCHAIN_SERVICE')
    private readonly blockchainClient: ClientKafka,
  ) {}

  async onModuleInit() {
    const topics = ['getToken', 'feeTokenWithdraw', 'caculatorFee'];

    topics.forEach((topic) => {
      this.blockchainClient.subscribeToResponseOf(topic);
    });

    await this.blockchainClient.connect();

    console.log('🔥 Kafka topics subscribed:', topics);
  }
}
