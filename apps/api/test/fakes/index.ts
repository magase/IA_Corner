import { createHash } from 'node:crypto';
import type { UserPlan, EntitlementsReader } from '../../src/shared/application/entitlements.js';
import type { Clock, IdGenerator } from '../../src/shared/application/ports.js';
import { ConflictError, UnauthorizedError } from '../../src/shared/domain/errors.js';
import type { IdentityProvider, User } from '../../src/modules/identity/domain/user.js';
import type {
  AccessTokenService,
  GoogleIdentity,
  GoogleTokenVerifier,
  OpaqueTokenGenerator,
  PasswordHasher,
  RefreshTokenRecord,
  RefreshTokenStore,
  UserRepository,
} from '../../src/modules/identity/application/ports.js';
import type { AthleteProfile } from '../../src/modules/profile/domain/athlete-profile.js';
import type {
  CatalogReader,
  HealthConsentReader,
  ProfileRepository,
} from '../../src/modules/profile/application/ports.js';

export class FixedClock implements Clock {
  constructor(private t = new Date('2026-11-25T10:00:00Z')) {}
  now() {
    return new Date(this.t);
  }
  advance(ms: number) {
    this.t = new Date(this.t.getTime() + ms);
  }
}

export class SequentialIds implements IdGenerator {
  private n = 0;
  next() {
    return `id-${++this.n}`;
  }
}

export class FakeHasher implements PasswordHasher {
  verifyCalls = 0;
  async hash(p: string) {
    return `hashed:${p}`;
  }
  async verify(h: string, p: string) {
    this.verifyCalls++;
    return h === `hashed:${p}`;
  }
}

export class FakeAccessTokens implements AccessTokenService {
  async issue(userId: string) {
    return { token: `access:${userId}`, expiresIn: 900 };
  }
  async verify(token: string) {
    if (!token.startsWith('access:')) throw new UnauthorizedError('bad', 'INVALID_TOKEN');
    return { userId: token.slice(7) };
  }
}

export class SequentialOpaqueTokens implements OpaqueTokenGenerator {
  private n = 0;
  generate() {
    return `rt-${++this.n}`;
  }
  hash(t: string) {
    return createHash('sha256').update(t).digest('hex');
  }
}

export class FakeGoogle implements GoogleTokenVerifier {
  readonly tokens = new Map<string, GoogleIdentity>();
  async verify(idToken: string) {
    const g = this.tokens.get(idToken);
    if (!g) throw new UnauthorizedError('bad', 'INVALID_GOOGLE_TOKEN');
    return g;
  }
}

export class InMemoryRefreshTokens implements RefreshTokenStore {
  readonly records = new Map<string, RefreshTokenRecord>();
  async save(r: RefreshTokenRecord) {
    this.records.set(r.id, { ...r });
  }
  async findByHash(h: string) {
    return [...this.records.values()].find((r) => r.tokenHash === h) ?? null;
  }
  async revoke(id: string, at: Date) {
    const r = this.records.get(id);
    if (!r || r.revokedAt) return false;
    r.revokedAt = at;
    return true;
  }
  async revokeFamily(familyId: string, at: Date) {
    for (const r of this.records.values())
      if (r.familyId === familyId && !r.revokedAt) r.revokedAt = at;
  }
  async revokeAllForUser(userId: string, at: Date) {
    for (const r of this.records.values())
      if (r.userId === userId && !r.revokedAt) r.revokedAt = at;
  }
  activeFor(userId: string) {
    return [...this.records.values()].filter((r) => r.userId === userId && !r.revokedAt);
  }
}

export class InMemoryProfiles implements ProfileRepository {
  readonly data = new Map<string, AthleteProfile>();
  async findByUserId(userId: string) {
    return this.data.get(userId) ?? null;
  }
  async upsert(userId: string, p: AthleteProfile) {
    this.data.set(userId, structuredClone(p));
  }
}

/** Repositorio de usuarios que además lee consentimiento y borra el perfil al retirarlo. */
export class InMemoryUsers implements UserRepository, HealthConsentReader {
  readonly users = new Map<string, User>();
  readonly identities: { userId: string; provider: IdentityProvider; providerId: string }[] = [];

  constructor(private readonly profiles: InMemoryProfiles = new InMemoryProfiles()) {}

  async findById(id: string) {
    return this.users.get(id) ?? null;
  }
  async findByEmail(email: string) {
    return [...this.users.values()].find((u) => u.email === email) ?? null;
  }
  async findByIdentity(provider: IdentityProvider, providerId: string) {
    const i = this.identities.find((x) => x.provider === provider && x.providerId === providerId);
    return i ? (this.users.get(i.userId) ?? null) : null;
  }
  async create(user: User, identity: { provider: IdentityProvider; providerId: string }) {
    if (await this.findByEmail(user.email)) throw new ConflictError('dup', 'EMAIL_TAKEN');
    this.users.set(user.id, { ...user });
    this.identities.push({ userId: user.id, ...identity });
  }
  async linkIdentity(userId: string, provider: IdentityProvider, providerId: string) {
    this.identities.push({ userId, provider, providerId });
  }
  async claimUnverifiedAccount(
    userId: string,
    provider: IdentityProvider,
    providerId: string,
    at: Date,
  ) {
    for (let i = this.identities.length - 1; i >= 0; i--) {
      const x = this.identities[i]!;
      if (x.userId === userId && x.provider === 'EMAIL') this.identities.splice(i, 1);
    }
    this.identities.push({ userId, provider, providerId });
    const u = this.users.get(userId);
    if (u) {
      u.emailVerifiedAt = at;
      u.passwordHash = null;
    }
  }
  async setHealthConsent(userId: string, at: Date | null) {
    const u = this.users.get(userId);
    if (u) u.healthDataConsentAt = at;
    if (!at) this.profiles.data.delete(userId);
  }
  async delete(userId: string) {
    this.users.delete(userId);
    this.profiles.data.delete(userId);
  }
  async exportData(userId: string) {
    const { passwordHash: _ph, ...user } = this.users.get(userId)!;
    return { user, profile: this.profiles.data.get(userId) ?? null };
  }
  async hasHealthConsent(userId: string) {
    return this.users.get(userId)?.healthDataConsentAt != null;
  }
}

export class InMemoryCatalog implements CatalogReader {
  constructor(
    readonly sports = new Set(['MUAY_THAI', 'BOXING', 'KICKBOXING', 'TAEKWONDO', 'KARATE']),
    readonly equipment = new Set(['NONE', 'DUMBBELLS', 'HEAVY_BAG', 'JUMP_ROPE']),
  ) {}
  async enabledSportCodes() {
    return this.sports;
  }
  async equipmentCodes() {
    return this.equipment;
  }
}

export class InMemoryEntitlements implements EntitlementsReader {
  readonly plans = new Map<string, UserPlan>();
  async forUser(userId: string) {
    return this.plans.get(userId) ?? { tier: 'FREE' as const, addOns: [] };
  }
}
