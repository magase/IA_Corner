import { beforeEach, describe, expect, it } from 'vitest';
import {
  FakeAccessTokens,
  FakeGoogle,
  FakeHasher,
  FixedClock,
  InMemoryEntitlements,
  InMemoryRefreshTokens,
  InMemoryUsers,
  SequentialIds,
  SequentialOpaqueTokens,
} from '../../../../test/fakes/index.js';
import { DeleteAccount, GetMe, SetHealthConsent } from './account.js';
import { LoginWithEmail } from './login-with-email.js';
import { LoginWithGoogle } from './login-with-google.js';
import { Logout } from './logout.js';
import { RefreshSession, ROTATION_GRACE_MS } from './refresh-session.js';
import { RegisterWithEmail, type RegisterWithEmailInput } from './register-with-email.js';
import { REFRESH_TTL_MS, SessionIssuer } from './session-issuer.js';

const ctx = { userAgent: 'vitest' };
const valid: RegisterWithEmailInput = {
  email: 'Ana@Corner.app',
  password: 'golpe-recto-2026',
  displayName: 'Ana',
  birthDate: '1995-05-10',
  locale: 'es',
  acceptTerms: true,
};

function setup() {
  const clock = new FixedClock();
  const ids = new SequentialIds();
  const users = new InMemoryUsers();
  const hasher = new FakeHasher();
  const store = new InMemoryRefreshTokens();
  const tokens = new SequentialOpaqueTokens();
  const google = new FakeGoogle();
  const entitlements = new InMemoryEntitlements();
  const sessions = new SessionIssuer(new FakeAccessTokens(), store, tokens, ids, clock);
  return {
    clock,
    users,
    hasher,
    store,
    google,
    entitlements,
    register: new RegisterWithEmail(users, hasher, sessions, ids, clock),
    login: new LoginWithEmail(users, hasher, sessions),
    googleLogin: new LoginWithGoogle(users, google, store, sessions, ids, clock),
    refresh: new RefreshSession(store, tokens, users, sessions, clock),
    logout: new Logout(store, tokens, clock),
    getMe: new GetMe(users, entitlements),
    consent: new SetHealthConsent(users, clock),
    deleteAccount: new DeleteAccount(users, hasher, google),
  };
}

let s: ReturnType<typeof setup>;
beforeEach(() => {
  s = setup();
});

describe('RegisterWithEmail', () => {
  it('creates the user with hashed password and returns a session', async () => {
    const session = await s.register.execute(valid, ctx);
    expect(session.user.email).toBe('ana@corner.app');
    expect(session.accessToken).toBe(`access:${session.user.id}`);
    expect(session.refreshToken).toBeTruthy();
    const stored = await s.users.findByEmail('ana@corner.app');
    expect(stored?.passwordHash).toBe('hashed:golpe-recto-2026');
    expect(s.store.activeFor(session.user.id)).toHaveLength(1);
  });

  it('rejects duplicated emails', async () => {
    await s.register.execute(valid, ctx);
    await expect(s.register.execute(valid, ctx)).rejects.toMatchObject({ reason: 'EMAIL_TAKEN' });
  });

  it('rejects minors', async () => {
    await expect(
      s.register.execute({ ...valid, birthDate: '2009-01-01' }, ctx),
    ).rejects.toMatchObject({
      reason: 'UNDERAGE',
    });
  });

  it('requires accepting terms', async () => {
    await expect(s.register.execute({ ...valid, acceptTerms: false }, ctx)).rejects.toMatchObject({
      reason: 'TERMS_REQUIRED',
    });
  });

  it('rejects weak passwords', async () => {
    await expect(s.register.execute({ ...valid, password: 'corta' }, ctx)).rejects.toMatchObject({
      reason: 'WEAK_PASSWORD',
    });
  });
});

describe('LoginWithEmail', () => {
  beforeEach(() => s.register.execute(valid, ctx));

  it('logs in with correct credentials (case-insensitive email)', async () => {
    const session = await s.login.execute(
      { email: 'ANA@corner.app', password: valid.password },
      ctx,
    );
    expect(session.user.email).toBe('ana@corner.app');
  });

  it('rejects wrong passwords', async () => {
    await expect(
      s.login.execute({ email: 'ana@corner.app', password: 'nope-12345' }, ctx),
    ).rejects.toMatchObject({
      reason: 'INVALID_CREDENTIALS',
    });
  });

  it('runs a hash verification even for unknown emails (timing)', async () => {
    const before = s.hasher.verifyCalls;
    await expect(
      s.login.execute({ email: 'ghost@corner.app', password: 'x' }, ctx),
    ).rejects.toMatchObject({
      reason: 'INVALID_CREDENTIALS',
    });
    expect(s.hasher.verifyCalls).toBe(before + 1);
  });
});

describe('LoginWithGoogle', () => {
  const base = {
    idToken: 'g1',
    birthDate: null,
    displayName: null,
    acceptTerms: false,
    locale: 'es' as const,
  };
  beforeEach(() => {
    s.google.tokens.set('g1', {
      sub: 'google-1',
      email: 'Leo@Gmail.com',
      emailVerified: true,
      name: 'Leo',
    });
  });

  it('asks for signup data the first time', async () => {
    await expect(s.googleLogin.execute(base, ctx)).rejects.toMatchObject({
      reason: 'SIGNUP_DATA_REQUIRED',
      details: { email: 'leo@gmail.com', suggestedName: 'Leo' },
    });
  });

  it('creates the account with birth date and terms, then logs in by identity', async () => {
    const first = await s.googleLogin.execute(
      { ...base, birthDate: '1990-01-01', acceptTerms: true },
      ctx,
    );
    expect(first.user.displayName).toBe('Leo');
    const again = await s.googleLogin.execute(base, ctx);
    expect(again.user.id).toBe(first.user.id);
  });

  it('enforces minimum age for Google signups', async () => {
    await expect(
      s.googleLogin.execute({ ...base, birthDate: '2010-01-01', acceptTerms: true }, ctx),
    ).rejects.toMatchObject({ reason: 'UNDERAGE' });
  });

  it('links to an existing VERIFIED email account keeping its password', async () => {
    const reg = await s.register.execute({ ...valid, email: 'leo@gmail.com' }, ctx);
    s.users.users.get(reg.user.id)!.emailVerifiedAt = new Date();
    const g = await s.googleLogin.execute(base, ctx);
    expect(g.user.id).toBe(reg.user.id);
    expect(s.users.users.get(reg.user.id)!.passwordHash).not.toBeNull();
    expect(s.store.activeFor(reg.user.id)).toHaveLength(2);
  });

  it('claims an UNVERIFIED account: wipes the (possibly attacker) password and sessions', async () => {
    // Un atacante registra el email de la víctima con su contraseña...
    const attacker = await s.register.execute({ ...valid, email: 'leo@gmail.com' }, ctx);
    // ...y la víctima entra con Google.
    const victim = await s.googleLogin.execute(base, ctx);
    expect(victim.user.id).toBe(attacker.user.id);
    expect(s.users.users.get(attacker.user.id)!.passwordHash).toBeNull();
    await expect(
      s.login.execute({ email: 'leo@gmail.com', password: valid.password }, ctx),
    ).rejects.toMatchObject({ reason: 'INVALID_CREDENTIALS' });
    await expect(s.refresh.execute(attacker.refreshToken, ctx)).rejects.toThrow();
    expect(s.store.activeFor(attacker.user.id)).toHaveLength(1);
  });

  it('rejects unverified Google emails', async () => {
    s.google.tokens.set('g2', {
      sub: 'google-2',
      email: 'x@gmail.com',
      emailVerified: false,
      name: null,
    });
    await expect(s.googleLogin.execute({ ...base, idToken: 'g2' }, ctx)).rejects.toMatchObject({
      reason: 'GOOGLE_EMAIL_UNVERIFIED',
    });
  });
});

describe('RefreshSession', () => {
  it('rotates the refresh token within the same family', async () => {
    const a = await s.register.execute(valid, ctx);
    const b = await s.refresh.execute(a.refreshToken, ctx);
    expect(b.refreshToken).not.toBe(a.refreshToken);
    const active = s.store.activeFor(a.user.id);
    expect(active).toHaveLength(1);
    const all = [...s.store.records.values()];
    expect(new Set(all.map((r) => r.familyId)).size).toBe(1);
  });

  it('tolerates concurrent rotations inside the grace window', async () => {
    const a = await s.register.execute(valid, ctx);
    const b = await s.refresh.execute(a.refreshToken, ctx);
    await expect(s.refresh.execute(a.refreshToken, ctx)).rejects.toMatchObject({
      reason: 'REFRESH_TOKEN_ROTATED',
    });
    await expect(s.refresh.execute(b.refreshToken, ctx)).resolves.toBeTruthy();
  });

  it('detects reuse after the grace window and revokes the whole family', async () => {
    const a = await s.register.execute(valid, ctx);
    const b = await s.refresh.execute(a.refreshToken, ctx);
    s.clock.advance(ROTATION_GRACE_MS + 1);
    await expect(s.refresh.execute(a.refreshToken, ctx)).rejects.toMatchObject({
      reason: 'REFRESH_TOKEN_REUSED',
    });
    // La familia entera queda revocada: el token más reciente tampoco sirve.
    expect(s.store.activeFor(a.user.id)).toHaveLength(0);
    await expect(s.refresh.execute(b.refreshToken, ctx)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('rejects expired and unknown tokens', async () => {
    const a = await s.register.execute(valid, ctx);
    s.clock.advance(REFRESH_TTL_MS + 1);
    await expect(s.refresh.execute(a.refreshToken, ctx)).rejects.toMatchObject({
      reason: 'REFRESH_TOKEN_EXPIRED',
    });
    await expect(s.refresh.execute('nope', ctx)).rejects.toMatchObject({
      reason: 'INVALID_REFRESH_TOKEN',
    });
    await expect(s.refresh.execute(undefined, ctx)).rejects.toMatchObject({
      reason: 'NO_REFRESH_TOKEN',
    });
  });
});

describe('Logout', () => {
  it('revokes the session family and is idempotent', async () => {
    const a = await s.register.execute(valid, ctx);
    await s.logout.execute(a.refreshToken);
    await s.logout.execute(a.refreshToken);
    await s.logout.execute(undefined);
    expect(s.store.activeFor(a.user.id)).toHaveLength(0);
  });
});

describe('account', () => {
  it('GetMe returns plan with free features and limits', async () => {
    const a = await s.register.execute(valid, ctx);
    const me = await s.getMe.execute(a.user.id);
    expect(me.plan.tier).toBe('FREE');
    expect(me.plan.limits.workoutLogRows).toBe(10);
    expect(me.plan.features).toContain('WIKI');
    expect(me.plan.features).not.toContain('ROUND_TIMER');
  });

  it('SetHealthConsent toggles consent', async () => {
    const a = await s.register.execute(valid, ctx);
    await s.consent.execute(a.user.id, true);
    expect(await s.users.hasHealthConsent(a.user.id)).toBe(true);
    await s.consent.execute(a.user.id, false);
    expect(await s.users.hasHealthConsent(a.user.id)).toBe(false);
  });

  it('DeleteAccount requires the password for password accounts', async () => {
    const a = await s.register.execute(valid, ctx);
    const proof = (password: string | null) => ({ password, googleIdToken: null });
    await expect(s.deleteAccount.execute(a.user.id, proof(null))).rejects.toMatchObject({
      reason: 'REAUTH_FAILED',
    });
    await expect(s.deleteAccount.execute(a.user.id, proof('wrong-pass-1'))).rejects.toMatchObject({
      reason: 'REAUTH_FAILED',
    });
    await s.deleteAccount.execute(a.user.id, proof(valid.password));
    expect(await s.users.findById(a.user.id)).toBeNull();
  });

  it('DeleteAccount on Google-only accounts requires a fresh token of the SAME identity', async () => {
    s.google.tokens.set('mine', {
      sub: 'g-me',
      email: 'me@gmail.com',
      emailVerified: true,
      name: 'Me',
    });
    s.google.tokens.set('other', {
      sub: 'g-o',
      email: 'o@gmail.com',
      emailVerified: true,
      name: 'O',
    });
    const g = await s.googleLogin.execute(
      {
        idToken: 'mine',
        birthDate: '1990-01-01',
        displayName: null,
        acceptTerms: true,
        locale: 'es',
      },
      ctx,
    );
    const del = (googleIdToken: string | null) =>
      s.deleteAccount.execute(g.user.id, { password: null, googleIdToken });
    await expect(del(null)).rejects.toMatchObject({ reason: 'REAUTH_FAILED' });
    await expect(del('other')).rejects.toMatchObject({ reason: 'REAUTH_FAILED' });
    await del('mine');
    expect(await s.users.findById(g.user.id)).toBeNull();
  });

  it('register hashes before the existence check (uniform cost)', async () => {
    await s.register.execute(valid, ctx);
    let hashed = 0;
    const orig = s.hasher.hash.bind(s.hasher);
    s.hasher.hash = async (p: string) => {
      hashed++;
      return orig(p);
    };
    await expect(s.register.execute(valid, ctx)).rejects.toMatchObject({ reason: 'EMAIL_TAKEN' });
    expect(hashed).toBe(1);
  });
});
