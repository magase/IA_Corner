import { hash, verify } from '@node-rs/argon2';
import type { PasswordHasher } from '../application/ports.js';

/** argon2id con los parámetros mínimos recomendados por OWASP (19 MiB, t=2, p=1). */
export class Argon2PasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
  }

  async verify(hashed: string, password: string): Promise<boolean> {
    try {
      return await verify(hashed, password);
    } catch {
      return false;
    }
  }
}
