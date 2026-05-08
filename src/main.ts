import './polyfill-crypto';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { env, parseKafkaBrokers } from './utils';

function buildSwaggerDocument(app: INestApplication) {
  let builder = new DocumentBuilder()
    .setTitle('API Docs')
    .setDescription('API documentation')
    .setVersion('1.0')
    .addBearerAuth();

  if (env.SWAGGER_SERVER_URL) {
    builder = builder.addServer(env.SWAGGER_SERVER_URL);
  }

  const config = builder.build();
  return SwaggerModule.createDocument(app, config);
}

async function waitKafkaReady(brokers: string[], retries = 5, delay = 2000) {
  const { Kafka } = await import('kafkajs');

  for (let i = 0; i < retries; i++) {
    try {
      const kafka = new Kafka({ brokers });
      const admin = kafka.admin();
      await admin.connect();
      console.log('✅ Kafka is ready');
      await admin.disconnect();
      return;
    } catch (err) {
      console.log(
        `Kafka not ready, retrying in ${delay}ms... (${i + 1}/${retries})`,
      );
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw new Error('Kafka not ready after max retries');
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  await waitKafkaReady(parseKafkaBrokers(env.KAFKA_BROKERS));

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: parseKafkaBrokers(env.KAFKA_BROKERS),
      },
      consumer: {
        groupId: 'user',
      },
    },
  });

  // Enable CORS
  app.enableCors({ origin: '*' });

  // Use global validation pipe
  app.useGlobalPipes(new ValidationPipe());

  const document = buildSwaggerDocument(app);
  SwaggerModule.setup(env.SWAGGER_PATH, app, document);

  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
