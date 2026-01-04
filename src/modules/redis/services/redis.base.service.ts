import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { env } from 'process';

@Injectable()
export class RedisBaseService implements OnModuleDestroy {
  readonly redis: Redis;
  readonly publisher: Redis;
  readonly subscriber: Redis;

  constructor() {
    const config = {
      host: env.REDIS_HOST ?? 'localhost',
      port: env.REDIS_PORT ? parseInt(env.REDIS_PORT) : 6379,
      db: env.REDIS_DATABASE ? parseInt(env.REDIS_DATABASE) : 0,
      password: env.REDIS_PASSWORD,
    };

    this.redis = new Redis(config);
    this.publisher = new Redis(config);
    this.subscriber = new Redis(config);
  }

  async publish(channel: string, message: string) {
    await this.publisher.publish(channel, message);
  }

  subscribe(channel: string, callback: (message: string) => void) {
    this.subscriber.subscribe(channel, (err) => {
      if (err) console.error(`❌ Failed to subscribe to ${channel}`, err);
      else console.log(`✅ Subscribed to channel: ${channel}`);
    });

    this.subscriber.on('message', (ch, message) => {
      if (ch === channel) callback(message);
    });
  }

  async onModuleDestroy() {
    await Promise.all([
      this.redis.quit(),
      this.publisher.quit(),
      this.subscriber.quit(),
    ]);
  }
}
