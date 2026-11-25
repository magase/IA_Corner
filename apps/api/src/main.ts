/* eslint-disable no-console */
import { createApp } from './app.js';
import { Argon2PasswordHasher } from './modules/identity/infrastructure/argon2-password-hasher.js';
import { CryptoOpaqueTokenGenerator } from './modules/identity/infrastructure/crypto-opaque-token-generator.js';
import { GoogleJwksVerifier } from './modules/identity/infrastructure/google-jwks-verifier.js';
import { JoseAccessTokenService } from './modules/identity/infrastructure/jose-access-token-service.js';
import { PrismaRefreshTokenStore } from './modules/identity/infrastructure/prisma-refresh-token-store.js';
import { PrismaUserRepository } from './modules/identity/infrastructure/prisma-user-repository.js';
import {
  PrismaCatalogReader,
  PrismaHealthConsentReader,
  PrismaProfileRepository,
} from './modules/profile/infrastructure/prisma-profile-repository.js';
import { loadEnv } from './shared/infrastructure/config/env.js';
import { PrismaEntitlementsReader } from './shared/infrastructure/persistence/prisma-entitlements-reader.js';
import { createPrismaClient } from './shared/infrastructure/persistence/prisma-client.js';
import { PrismaHealthChecker } from './shared/infrastructure/persistence/prisma-health-checker.js';
import { CryptoIdGenerator, SystemClock } from './shared/infrastructure/system.js';

const env = loadEnv();
const prisma = createPrismaClient(env.DATABASE_URL);
const clock = new SystemClock();

const server = createApp({
  config: {
    corsOrigins: env.CORS_ORIGINS,
    cookieSecure: env.COOKIE_SECURE,
    trustProxyHops: env.TRUST_PROXY_HOPS,
  },
  clock,
  ids: new CryptoIdGenerator(),
  healthChecker: new PrismaHealthChecker(prisma),
  users: new PrismaUserRepository(prisma),
  refreshTokens: new PrismaRefreshTokenStore(prisma),
  hasher: new Argon2PasswordHasher(),
  accessTokens: new JoseAccessTokenService(env.JWT_ACCESS_SECRET),
  opaqueTokens: new CryptoOpaqueTokenGenerator(),
  google: new GoogleJwksVerifier(env.GOOGLE_CLIENT_ID),
  profiles: new PrismaProfileRepository(prisma),
  catalog: new PrismaCatalogReader(prisma),
  consent: new PrismaHealthConsentReader(prisma),
  entitlements: new PrismaEntitlementsReader(prisma, clock),
  logger: { error: (m, e) => console.error(m, e instanceof Error ? e.message : e) },
});

server.listen(env.PORT, () => console.log(`Corner API escuchando en :${env.PORT}`));

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
