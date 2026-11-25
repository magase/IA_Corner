import type { Clock } from '../../../shared/application/ports.js';
import type { OpaqueTokenGenerator, RefreshTokenStore } from './ports.js';

/** Idempotente: cierra la sesión (familia de refresh tokens) si existe. */
export class Logout {
  constructor(
    private readonly store: RefreshTokenStore,
    private readonly tokens: OpaqueTokenGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const record = await this.store.findByHash(this.tokens.hash(refreshToken));
    if (record) await this.store.revokeFamily(record.familyId, this.clock.now());
  }
}
