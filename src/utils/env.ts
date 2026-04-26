import { z } from 'zod';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

const envFile = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
  console.log('✅ .env loaded from', envFile);
} else {
  console.warn('⚠️ No .env file found, using process.env only');
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(3000),

  DB_NAME: z.string().min(1, 'DB_NAME is required'),
  DB_USERNAME: z.string().min(1, 'DB_USERNAME is required'),
  DB_PASSWORD: z.string().min(1, 'DB_PASSWORD is required'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_SYNC: z.coerce.boolean().default(false), // convert 0/1 sang boolean

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_DATABASE: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),

  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  emailAdmin: z
    .string()
    .min(1, 'emailAdmin is required')
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'emailAdmin must be a valid email'),
  passwordAdmin: z.string().min(1, 'passwordAdmin is required'),
  roleAdmin: z.string().min(1, 'roleAdmin is required'),

  KAFKA_BROKERS: z.string().default('kafka://localhost:9092'),
  KAFKA_WALLET_DEPOSIT_TOPIC: z.string().default('wallet.deposit.v1'),
});

// Parse process.env
const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  if (process.env.NODE_ENV !== 'production') {
    throw new Error('Invalid environment variables');
  } else {
    console.warn(
      '⚠️ Missing env vars in production, please check Render dashboard',
    );
  }
}

export const env = _env.data!;
export type EnvType = typeof env;
