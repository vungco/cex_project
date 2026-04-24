/**
 * Node 18: Web Crypto (`globalThis.crypto`) không gắn sẵn. @nestjs/typeorm gọi `crypto.randomUUID()`.
 * Import file này trước mọi module Nest/TypeORM.
 */
import { webcrypto } from 'node:crypto';

if (typeof globalThis.crypto === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
    enumerable: true,
    writable: false,
  });
}
