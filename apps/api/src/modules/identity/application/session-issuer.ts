import type { PublicUserDto } from '@corner/shared';
import type { Clock, IdGenerator } from '../../../shared/application/ports.js';
import { toPublicUser, type User } from '../domain/user.js';
import type { AccessTokenService, OpaqueTokenGenerator, RefreshTokenStore } from './ports.js';

export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface Session {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: PublicUserDto;
}

export interface SessionContext {
  userAgent: string | null;
}

export class SessionIssuer {
  constructor(
    private readonly accessTokens: AccessTokenService,
    private readonly refreshTokens: RefreshTokenStore,
    private readonly tokens: OpaqueTokenGenerator,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly refreshTtlMs: number = REFRESH_TTL_MS,
  ) {}

  /** `familyId` se conserva en las rotaciones para poder revocar toda la cadena. */
  async issue(user: User, ctx: SessionContext, familyId: string | null = null): Promise<Session> {
    const { token: accessToken, expiresIn } = await this.accessTokens.issue(user.id);
    const refreshToken = this.tokens.generate();
    const refreshExpiresAt = new Date(this.clock.now().getTime() + this.refreshTtlMs);
    await this.refreshTokens.save({
      id: this.ids.next(),
      userId: user.id,
      tokenHash: this.tokens.hash(refreshToken),
      familyId: familyId ?? this.ids.next(),
      expiresAt: refreshExpiresAt,
      revokedAt: null,
      userAgent: ctx.userAgent?.slice(0, 255) ?? null,
    });
    return { accessToken, expiresIn, refreshToken, refreshExpiresAt, user: toPublicUser(user) };
  }
}
