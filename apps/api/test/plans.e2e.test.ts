import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp } from './helpers/build-test-app.js';

const json = { 'Content-Type': 'application/json' };
const profile = {
  sex: 'FEMALE',
  heightCm: 165,
  weightKg: 58,
  level: 'BEGINNER',
  goal: 'GENERAL_FITNESS',
  activityLevel: 'MODERATE',
  daysPerWeek: 3,
  sessionMinutes: 45,
  sports: [
    { code: 'MUAY_THAI', level: 'BEGINNER' },
    { code: 'BOXING', level: 'BEGINNER' },
  ],
  equipment: ['JUMP_ROPE'],
};
const workout = {
  performedAt: '2026-11-25T18:00:00Z',
  rpe: 7,
  entries: [{ exerciseSlug: 'push-up', setIndex: 1, reps: 10 }],
};

describe('Planes y registro (e2e)', () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;
  let token = '';
  const call = (method: string, path: string, body?: unknown) =>
    fetch(`${app.base}${path}`, {
      method,
      headers: { ...json, Authorization: `Bearer ${token}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  beforeAll(async () => {
    app = await startTestApp();
    const reg = await fetch(`${app.base}/api/v1/auth/register`, {
      method: 'POST',
      headers: json,
      body: JSON.stringify({
        email: 'plan@corner.app',
        password: 'golpe-recto-2026',
        displayName: 'Plan',
        birthDate: '1994-04-04',
        acceptTerms: true,
      }),
    });
    token = (await reg.json()).accessToken;
  });
  afterAll(() => app.close());

  it('requires consent and profile before generating plans', async () => {
    expect((await call('POST', '/api/v1/me/plans/training')).status).toBe(403);
    await call('PUT', '/api/v1/me/consents/health', { accepted: true });
    const noProfile = await call('POST', '/api/v1/me/plans/training');
    expect(noProfile.status).toBe(404);
    expect((await noProfile.json()).reason).toBe('PROFILE_NOT_FOUND');
    expect((await call('PUT', '/api/v1/me/profile', profile)).status).toBe(200);
  });

  it('generates the free training plan and returns it', async () => {
    const res = await call('POST', '/api/v1/me/plans/training', { mode: 'TEMPLATE' });
    expect(res.status).toBe(201);
    const plan = await res.json();
    expect(plan.sessions).toHaveLength(3);
    const drills = plan.sessions.flatMap((s: { exercises: { slug: string }[] }) =>
      s.exercises.map((e) => e.slug),
    );
    expect(drills.some((s: string) => s.startsWith('boxing-'))).toBe(true);
    expect((await (await call('GET', '/api/v1/me/plans/training')).json()).id).toBe(plan.id);
  });

  it('AI plan is premium-only (402)', async () => {
    const res = await call('POST', '/api/v1/me/plans/training', {
      mode: 'AI',
      request: 'quiero más potencia',
    });
    expect(res.status).toBe(402);
    expect((await res.json()).reason).toBe('AI_PERSONALIZED_PLAN');
  });

  it('nutrition: general is free, calculated is premium', async () => {
    const g = await call('POST', '/api/v1/me/plans/nutrition');
    expect(g.status).toBe(201);
    expect(await g.json()).toMatchObject({
      kind: 'GENERAL',
      targets: null,
      requiresHealthDisclaimer: true,
    });
    const c = await call('POST', '/api/v1/me/plans/nutrition', { kind: 'CALCULATED' });
    expect(c.status).toBe(402);
    expect((await c.json()).reason).toBe('MACRO_CALCULATOR');
  });

  it('workout log: 10 free rows, then 402; delete frees space; delete all', async () => {
    for (let i = 0; i < 10; i++)
      expect((await call('POST', '/api/v1/me/workouts', workout)).status).toBe(201);
    const blocked = await call('POST', '/api/v1/me/workouts', workout);
    expect(blocked.status).toBe(402);
    expect(await blocked.json()).toMatchObject({
      reason: 'WORKOUT_LOG_LIMIT',
      details: { limit: 10, used: 10 },
    });

    const hist = await (await call('GET', '/api/v1/me/workouts?pageSize=5')).json();
    expect(hist).toMatchObject({ total: 10, limit: 10 });
    expect(hist.items).toHaveLength(5);

    expect((await call('DELETE', `/api/v1/me/workouts/${hist.items[0].id}`)).status).toBe(204);
    expect((await call('POST', '/api/v1/me/workouts', workout)).status).toBe(201);

    const all = await call('DELETE', '/api/v1/me/workouts');
    expect(await all.json()).toEqual({ deleted: 10 });
  });

  it('withdrawing consent hides the plans', async () => {
    expect((await call('GET', '/api/v1/me/plans/training')).status).toBe(200);
    await call('PUT', '/api/v1/me/consents/health', { accepted: false });
    const res = await call('GET', '/api/v1/me/plans/nutrition');
    expect(res.status).toBe(403);
    expect((await res.json()).reason).toBe('HEALTH_CONSENT_REQUIRED');
    await call('PUT', '/api/v1/me/consents/health', { accepted: true });
  });

  it('rejects invalid workout payloads and ids', async () => {
    expect(
      (await call('POST', '/api/v1/me/workouts', { ...workout, performedAt: 'ayer' })).status,
    ).toBe(400);
    expect((await call('POST', '/api/v1/me/workouts', { ...workout, hack: true })).status).toBe(
      400,
    );
    expect((await call('GET', '/api/v1/me/workouts/not-a-uuid')).status).toBe(400);
    expect(
      (await call('GET', '/api/v1/me/workouts/00000000-0000-4000-8000-999999999999')).status,
    ).toBe(404);
  });
});
