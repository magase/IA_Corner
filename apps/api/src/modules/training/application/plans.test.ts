import { beforeEach, describe, expect, it } from 'vitest';
import {
  FixedClock,
  InMemoryEntitlements,
  InMemoryProfiles,
  InMemoryUsers,
} from '../../../../test/fakes/index.js';
import {
  InMemoryAthletes,
  InMemoryCandidates,
  InMemoryNutritionPlans,
  InMemoryTrainingPlans,
} from '../../../../test/fakes/plans.js';
import {
  GenerateNutritionPlan,
  GetActiveNutritionPlan,
} from '../../nutrition/application/nutrition-use-cases.js';
import type { AthleteProfile } from '../../profile/domain/athlete-profile.js';
import { GenerateTrainingPlan, GetActiveTrainingPlan } from './training-use-cases.js';

const profile: AthleteProfile = {
  sex: 'MALE',
  heightCm: 178,
  weightKg: 75,
  bodyFatPct: null,
  level: 'INTERMEDIATE',
  goal: 'CONDITIONING',
  activityLevel: 'HIGH',
  daysPerWeek: 4,
  sessionMinutes: 60,
  injuriesNotes: null,
  sports: [{ code: 'MUAY_THAI', level: 'INTERMEDIATE' }],
  equipment: ['NONE'],
  dietRestrictions: [],
};

function setup() {
  const clock = new FixedClock(new Date('2026-11-26T10:00:00Z'));
  const profiles = new InMemoryProfiles();
  const users = new InMemoryUsers(profiles);
  users.users.set('u1', {
    id: 'u1',
    email: 'a@b.co',
    displayName: 'A',
    locale: 'es',
    birthDate: new Date('1996-11-26'),
    passwordHash: null,
    emailVerifiedAt: null,
    healthDataConsentAt: new Date(),
    createdAt: new Date(),
  });
  profiles.data.set('u1', profile);
  const ent = new InMemoryEntitlements();
  const athletes = new InMemoryAthletes(users, profiles);
  const training = new InMemoryTrainingPlans();
  const nutrition = new InMemoryNutritionPlans();
  return {
    users,
    profiles,
    ent,
    training,
    gen: new GenerateTrainingPlan(athletes, new InMemoryCandidates(), training, ent, clock),
    get: new GetActiveTrainingPlan(training, athletes),
    getNut: new GetActiveNutritionPlan(nutrition, athletes, ent),
    nut: new GenerateNutritionPlan(athletes, nutrition, ent, clock),
  };
}

let s: ReturnType<typeof setup>;
beforeEach(() => {
  s = setup();
});

describe('GenerateTrainingPlan', () => {
  it('generates and stores the active plan, archiving the previous one', async () => {
    const a = await s.gen.execute('u1', { mode: 'TEMPLATE' }, 'es');
    expect(a.sessions).toHaveLength(4);
    expect(a).toMatchObject({
      source: 'TEMPLATE',
      name: 'CONDITIONING_4D',
      startsOn: '2026-11-26',
    });
    const b = await s.gen.execute('u1', { mode: 'TEMPLATE' }, 'es');
    expect((await s.get.execute('u1', 'es')).id).toBe(b.id);
    expect(s.training.plans.filter((p) => p.active)).toHaveLength(1);
  });

  it('requires consent and a profile', async () => {
    await s.users.setHealthConsent('u1', null);
    await expect(s.gen.execute('u1', { mode: 'TEMPLATE' }, 'es')).rejects.toMatchObject({
      reason: 'HEALTH_CONSENT_REQUIRED',
    });
    await s.users.setHealthConsent('u1', new Date());
    await expect(s.gen.execute('u1', { mode: 'TEMPLATE' }, 'es')).rejects.toMatchObject({
      reason: 'PROFILE_NOT_FOUND',
    });
  });

  it('AI mode is premium; premium without personalizer reports unavailable', async () => {
    await expect(
      s.gen.execute('u1', { mode: 'AI', request: 'más cardio' }, 'es'),
    ).rejects.toMatchObject({
      code: 'PREMIUM_REQUIRED',
      reason: 'AI_PERSONALIZED_PLAN',
    });
    s.ent.plans.set('u1', { tier: 'PREMIUM', addOns: [] });
    await expect(
      s.gen.execute('u1', { mode: 'AI', request: 'más cardio' }, 'es'),
    ).rejects.toMatchObject({
      reason: 'AI_PLAN_UNAVAILABLE',
    });
  });

  it('reading the plan requires current health consent', async () => {
    await s.gen.execute('u1', { mode: 'TEMPLATE' }, 'es');
    await s.users.setHealthConsent('u1', null);
    await expect(s.get.execute('u1', 'es')).rejects.toMatchObject({
      reason: 'HEALTH_CONSENT_REQUIRED',
    });
  });

  it('GetActiveTrainingPlan returns NOT_FOUND before generating', async () => {
    await expect(s.get.execute('u1', 'es')).rejects.toMatchObject({ reason: 'PLAN_NOT_FOUND' });
  });
});

describe('GenerateNutritionPlan', () => {
  it('free: general guidelines without calorie targets', async () => {
    const p = await s.nut.execute('u1', 'GENERAL', 'es');
    expect(p).toMatchObject({ kind: 'GENERAL', targets: null, requiresHealthDisclaimer: true });
    expect(p.guidelines.length).toBeGreaterThan(3);
    expect(p.supplements.map((x) => x.slug)).toContain('creatina-monohidrato');
  });

  it('hides calculated targets after premium ends', async () => {
    s.ent.plans.set('u1', { tier: 'PREMIUM', addOns: [] });
    await s.nut.execute('u1', 'CALCULATED', 'es');
    expect((await s.getNut.execute('u1', 'es')).targets).not.toBeNull();
    s.ent.plans.delete('u1');
    expect((await s.getNut.execute('u1', 'es')).targets).toBeNull();
  });

  it('calculated targets are premium', async () => {
    await expect(s.nut.execute('u1', 'CALCULATED', 'es')).rejects.toMatchObject({
      code: 'PREMIUM_REQUIRED',
      reason: 'MACRO_CALCULATOR',
    });
    s.ent.plans.set('u1', { tier: 'PREMIUM', addOns: [] });
    const p = await s.nut.execute('u1', 'CALCULATED', 'es');
    // 30 años: 10*75 + 6.25*178 - 5*30 + 5 = 1717.5 × 1.725
    expect(p.targets?.kcal).toBe(Math.round((1717.5 * 1.725) / 10) * 10);
    expect(p.targets?.proteinG).toBe(135);
  });
});
