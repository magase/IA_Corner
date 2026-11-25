import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp, type AppDeps } from '../../src/app.js';
import { CryptoOpaqueTokenGenerator } from '../../src/modules/identity/infrastructure/crypto-opaque-token-generator.js';
import { JoseAccessTokenService } from '../../src/modules/identity/infrastructure/jose-access-token-service.js';
import { InMemoryRateLimiter } from '../../src/shared/infrastructure/http/rate-limiter.js';
import {
  FakeGoogle,
  FakeHasher,
  FixedClock,
  InMemoryCatalog,
  InMemoryEntitlements,
  InMemoryProfiles,
  InMemoryRefreshTokens,
  InMemoryUsers,
  SequentialIds,
} from '../fakes/index.js';

export const ORIGIN = 'http://localhost:4200';

export async function startTestApp(overrides: Partial<AppDeps> = {}) {
  const profiles = new InMemoryProfiles();
  const users = new InMemoryUsers(profiles);
  const google = new FakeGoogle();
  const entitlements = new InMemoryEntitlements();
  const refreshTokens = new InMemoryRefreshTokens();
  const clock = new FixedClock(new Date());
  const deps: AppDeps = {
    config: { corsOrigins: [ORIGIN], cookieSecure: true, trustProxyHops: 0 },
    clock,
    ids: new SequentialIds(),
    healthChecker: { isDatabaseUp: async () => true },
    users,
    refreshTokens,
    hasher: new FakeHasher(),
    accessTokens: new JoseAccessTokenService('e2e-secret-'.repeat(4)),
    opaqueTokens: new CryptoOpaqueTokenGenerator(),
    google,
    profiles,
    catalog: new InMemoryCatalog(),
    consent: users,
    entitlements,
    authRateLimiter: new InMemoryRateLimiter(1000, 60_000),
    refreshRateLimiter: new InMemoryRateLimiter(1000, 60_000),
    ...overrides,
  };
  const server: Server = createApp(deps);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    base,
    clock,
    users,
    google,
    entitlements,
    refreshTokens,
    close: () =>
      new Promise<void>((r) => {
        server.closeAllConnections();
        server.close(() => r());
      }),
  };
}

/** Extrae el valor de la cookie corner_rt de una respuesta. */
export function refreshCookie(res: Response): string | null {
  const raw = res.headers.getSetCookie().find((c) => c.startsWith('corner_rt='));
  return raw ? (raw.split(';')[0] ?? null) : null;
}
