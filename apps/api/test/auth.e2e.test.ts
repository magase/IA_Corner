import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ROTATION_GRACE_MS } from '../src/modules/identity/application/refresh-session.js';
import { InMemoryRateLimiter } from '../src/shared/infrastructure/http/rate-limiter.js';
import { refreshCookie, startTestApp } from './helpers/build-test-app.js';

const json = { 'Content-Type': 'application/json' };
const client = { 'X-Corner-Client': '1' };
const signup = {
  email: 'ana@corner.app',
  password: 'golpe-recto-2026',
  displayName: 'Ana',
  birthDate: '1995-05-10',
  acceptTerms: true,
};
const profile = {
  sex: 'FEMALE',
  heightCm: 168,
  weightKg: 61.5,
  level: 'INTERMEDIATE',
  goal: 'CONDITIONING',
  activityLevel: 'HIGH',
  daysPerWeek: 4,
  sessionMinutes: 60,
  sports: [{ code: 'MUAY_THAI', level: 'INTERMEDIATE' }],
  equipment: ['JUMP_ROPE', 'HEAVY_BAG'],
};

describe('Auth + perfil (e2e)', () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;
  const post = (path: string, body?: unknown, headers: Record<string, string> = {}) =>
    fetch(`${app.base}${path}`, {
      method: 'POST',
      headers: { ...json, ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const call = (method: string, path: string, token: string, body?: unknown) =>
    fetch(`${app.base}${path}`, {
      method,
      headers: { ...json, Authorization: `Bearer ${token}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  beforeAll(async () => {
    app = await startTestApp();
  });
  afterAll(() => app.close());

  it('full flow: register → me → consent → profile → refresh rotation → reuse → logout', async () => {
    const reg = await post('/api/v1/auth/register', signup);
    expect(reg.status).toBe(201);
    const { accessToken, user } = await reg.json();
    expect(user).toMatchObject({ email: 'ana@corner.app', hasHealthConsent: false, locale: 'es' });
    expect(user).not.toHaveProperty('passwordHash');

    const setCookie = reg.headers.getSetCookie().find((c) => c.startsWith('corner_rt='))!;
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/Secure/);
    expect(setCookie).toMatch(/SameSite=Strict/);
    expect(setCookie).toMatch(/Path=\/api\/v1\/auth/);
    const rt1 = refreshCookie(reg)!;

    const me = await call('GET', '/api/v1/me', accessToken);
    expect(me.status).toBe(200);
    expect((await me.json()).plan).toMatchObject({ tier: 'FREE', limits: { workoutLogRows: 10 } });

    expect((await call('PUT', '/api/v1/me/profile', accessToken, profile)).status).toBe(403);
    expect(
      (await call('PUT', '/api/v1/me/consents/health', accessToken, { accepted: true })).status,
    ).toBe(204);
    const put = await call('PUT', '/api/v1/me/profile', accessToken, profile);
    expect(put.status).toBe(200);
    const got = await call('GET', '/api/v1/me/profile', accessToken);
    expect(await got.json()).toMatchObject({
      weightKg: 61.5,
      bodyFatPct: null,
      dietRestrictions: [],
    });

    // Restricciones dietéticas → 402 en plan gratis
    const diet = await call('PUT', '/api/v1/me/profile', accessToken, {
      ...profile,
      dietRestrictions: ['VEGAN'],
    });
    expect(diet.status).toBe(402);
    expect(await diet.json()).toMatchObject({
      error: 'PREMIUM_REQUIRED',
      reason: 'DIET_RESTRICTIONS',
    });

    // Refresh sin cabecera anti-CSRF → 403
    expect((await post('/api/v1/auth/refresh', undefined, { Cookie: rt1 })).status).toBe(403);

    const r2 = await post('/api/v1/auth/refresh', undefined, { ...client, Cookie: rt1 });
    expect(r2.status).toBe(200);
    const rt2 = refreshCookie(r2)!;
    expect(rt2).not.toBe(rt1);

    // Reutilizar rt1 justo después (otra pestaña) no mata la sesión...
    const race = await post('/api/v1/auth/refresh', undefined, { ...client, Cookie: rt1 });
    expect(race.status).toBe(401);
    expect((await race.json()).reason).toBe('REFRESH_TOKEN_ROTATED');

    // ...pero reutilizarlo pasado el margen revoca toda la familia (rt2 también deja de valer)
    app.clock.advance(ROTATION_GRACE_MS + 1);
    const reuse = await post('/api/v1/auth/refresh', undefined, { ...client, Cookie: rt1 });
    expect(reuse.status).toBe(401);
    expect((await reuse.json()).reason).toBe('REFRESH_TOKEN_REUSED');
    expect((await post('/api/v1/auth/refresh', undefined, { ...client, Cookie: rt2 })).status).toBe(
      401,
    );

    // Login de nuevo y logout
    const login = await post('/api/v1/auth/login', {
      email: signup.email,
      password: signup.password,
    });
    expect(login.status).toBe(200);
    const rt3 = refreshCookie(login)!;
    const out = await post('/api/v1/auth/logout', undefined, { ...client, Cookie: rt3 });
    expect(out.status).toBe(204);
    expect(refreshCookie(out)).toBe('corner_rt=');
    expect((await post('/api/v1/auth/refresh', undefined, { ...client, Cookie: rt3 })).status).toBe(
      401,
    );
  });

  it('rejects requests without or with an invalid access token', async () => {
    expect((await fetch(`${app.base}/api/v1/me`)).status).toBe(401);
    expect((await call('GET', '/api/v1/me', 'garbage')).status).toBe(401);
  });

  it('returns structured validation errors', async () => {
    const res = await post('/api/v1/auth/register', { ...signup, email: 'x@corner.app', extra: 1 });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'VALIDATION_ERROR', reason: 'INVALID_BODY' });

    const minor = await post('/api/v1/auth/register', {
      ...signup,
      email: 'kid@corner.app',
      birthDate: '2015-01-01',
    });
    expect(await minor.json()).toMatchObject({ reason: 'UNDERAGE' });

    const dup = await post('/api/v1/auth/register', signup);
    expect(dup.status).toBe(409);
  });

  it('Google signup asks for missing data, then creates the account', async () => {
    app.google.tokens.set('tok', {
      sub: 'g-1',
      email: 'leo@gmail.com',
      emailVerified: true,
      name: 'Leo',
    });
    const first = await post('/api/v1/auth/google', { idToken: 'tok' });
    expect(first.status).toBe(400);
    expect(await first.json()).toMatchObject({
      reason: 'SIGNUP_DATA_REQUIRED',
      details: { suggestedName: 'Leo' },
    });

    const second = await post('/api/v1/auth/google', {
      idToken: 'tok',
      birthDate: '1992-03-03',
      acceptTerms: true,
    });
    expect(second.status).toBe(200);
    expect((await second.json()).user.email).toBe('leo@gmail.com');
  });

  it('withdrawing consent deletes the profile; account export and deletion work', async () => {
    const reg = await post('/api/v1/auth/register', { ...signup, email: 'rgpd@corner.app' });
    const { accessToken } = await reg.json();
    await call('PUT', '/api/v1/me/consents/health', accessToken, { accepted: true });
    await call('PUT', '/api/v1/me/profile', accessToken, profile);
    await call('PUT', '/api/v1/me/consents/health', accessToken, { accepted: false });
    expect((await call('GET', '/api/v1/me/profile', accessToken)).status).toBe(403);

    const exp = await call('GET', '/api/v1/me/export', accessToken);
    expect(exp.status).toBe(200);
    expect(JSON.stringify(await exp.json())).not.toContain('hashed:');

    const wrong = await call('DELETE', '/api/v1/me', accessToken, { password: 'wrong-pass-1' });
    expect(wrong.status).toBe(401);
    expect((await wrong.json()).reason).toBe('REAUTH_FAILED');
    expect(
      (await call('DELETE', '/api/v1/me', accessToken, { password: signup.password })).status,
    ).toBe(204);
    expect((await call('GET', '/api/v1/me', accessToken)).status).toBe(404);
  });
});

describe('Rate limit de credenciales (e2e)', () => {
  it('blocks brute force on login with 429 and Retry-After', async () => {
    const app = await startTestApp({ authRateLimiter: new InMemoryRateLimiter(3, 60_000) });
    try {
      const attempt = () =>
        fetch(`${app.base}/api/v1/auth/login`, {
          method: 'POST',
          headers: json,
          body: JSON.stringify({ email: 'a@b.co', password: 'x' }),
        });
      for (let i = 0; i < 3; i++) expect((await attempt()).status).toBe(401);
      const blocked = await attempt();
      expect(blocked.status).toBe(429);
      expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  });
});

describe('Reautenticación al borrar la cuenta (e2e)', () => {
  it('rate-limits password guesses on DELETE /me', async () => {
    const app = await startTestApp({ authRateLimiter: new InMemoryRateLimiter(3, 60_000) });
    try {
      const reg = await fetch(`${app.base}/api/v1/auth/register`, {
        method: 'POST',
        headers: json,
        body: JSON.stringify(signup),
      });
      const { accessToken } = await reg.json();
      const guess = () =>
        fetch(`${app.base}/api/v1/me`, {
          method: 'DELETE',
          headers: { ...json, Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ password: 'guess-12345' }),
        });
      // Límite 3 en el bucket de reautenticación (independiente del de login/registro)
      for (let i = 0; i < 3; i++) expect((await guess()).status).toBe(401);
      const blocked = await guess();
      expect(blocked.status).toBe(429);
      expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  });
});
