import type { Clock } from '../../../shared/application/ports.js';
import { UnauthorizedError } from '../../../shared/domain/errors.js';
import type { OpaqueTokenGenerator, RefreshTokenStore, UserRepository } from './ports.js';
import type { Session, SessionContext, SessionIssuer } from './session-issuer.js';

/** Rotaciones casi simultáneas (varias pestañas, reintentos) no se tratan como robo. */
export const ROTATION_GRACE_MS = 30_000;

export class RefreshSession {
  constructor(
    private readonly store: RefreshTokenStore,
    private readonly tokens: OpaqueTokenGenerator,
    private readonly users: UserRepository,
    private readonly sessions: SessionIssuer,
    private readonly clock: Clock,
  ) {}

  async execute(refreshToken: string | undefined, ctx: SessionContext): Promise<Session> {
    if (!refreshToken) throw unauthorized('NO_REFRESH_TOKEN');
    const now = this.clock.now();
    const record = await this.store.findByHash(this.tokens.hash(refreshToken));
    if (!record) throw unauthorized('INVALID_REFRESH_TOKEN');

    if (record.revokedAt) {
      if (now.getTime() - record.revokedAt.getTime() < ROTATION_GRACE_MS) {
        // Otra petición acaba de rotarlo: el cliente ya tiene el token nuevo. No es robo.
        throw unauthorized('REFRESH_TOKEN_ROTATED');
      }
      // Reutilización de un token rotado hace tiempo: posible robo → revocar toda la familia.
      await this.store.revokeFamily(record.familyId, now);
      throw unauthorized('REFRESH_TOKEN_REUSED');
    }
    if (record.expiresAt.getTime() <= now.getTime()) throw unauthorized('REFRESH_TOKEN_EXPIRED');

    // Compare-and-set atómico: si otra petición lo rotó a la vez, esta pierde sin revocar la familia.
    if (!(await this.store.revoke(record.id, now))) throw unauthorized('REFRESH_TOKEN_ROTATED');

    const user = await this.users.findById(record.userId);
    if (!user) throw unauthorized('INVALID_REFRESH_TOKEN');
    return this.sessions.issue(user, ctx, record.familyId);
  }
}

const unauthorized = (reason: string) => new UnauthorizedError('Sesión no válida', reason);
