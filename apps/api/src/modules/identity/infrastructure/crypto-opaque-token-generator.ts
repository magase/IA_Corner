import { createHash, randomBytes } from 'node:crypto';
import type { OpaqueTokenGenerator } from '../application/ports.js';

export class CryptoOpaqueTokenGenerator implements OpaqueTokenGenerator {
  generate(): string {
    return randomBytes(32).toString('base64url');
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
