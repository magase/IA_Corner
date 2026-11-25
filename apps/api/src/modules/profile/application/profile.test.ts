import { beforeEach, describe, expect, it } from 'vitest';
import {
  InMemoryCatalog,
  InMemoryEntitlements,
  InMemoryProfiles,
  InMemoryUsers,
} from '../../../../test/fakes/index.js';
import type { AthleteProfile } from '../domain/athlete-profile.js';
import { GetAthleteProfile, UpsertAthleteProfile } from './profile-use-cases.js';

const profile: AthleteProfile = {
  sex: 'MALE',
  heightCm: 178,
  weightKg: 74.456,
  bodyFatPct: 14.26,
  level: 'INTERMEDIATE',
  goal: 'CONDITIONING',
  activityLevel: 'HIGH',
  daysPerWeek: 4,
  sessionMinutes: 75,
  injuriesNotes: '  ',
  sports: [
    { code: 'MUAY_THAI', level: 'INTERMEDIATE' },
    { code: 'BOXING', level: 'BEGINNER' },
  ],
  equipment: ['DUMBBELLS', 'HEAVY_BAG'],
  dietRestrictions: [],
};

function setup() {
  const profiles = new InMemoryProfiles();
  const users = new InMemoryUsers(profiles);
  const entitlements = new InMemoryEntitlements();
  users.users.set('u1', {
    id: 'u1',
    email: 'a@b.co',
    displayName: 'A',
    locale: 'es',
    birthDate: new Date('1990-01-01'),
    passwordHash: null,
    emailVerifiedAt: null,
    healthDataConsentAt: new Date(),
    createdAt: new Date(),
  });
  return {
    users,
    profiles,
    entitlements,
    upsert: new UpsertAthleteProfile(profiles, new InMemoryCatalog(), users, entitlements),
    get: new GetAthleteProfile(profiles, users),
  };
}

let s: ReturnType<typeof setup>;
beforeEach(() => {
  s = setup();
});

describe('UpsertAthleteProfile', () => {
  it('stores a normalized profile with several sports', async () => {
    const saved = await s.upsert.execute('u1', profile);
    expect(saved.weightKg).toBe(74.46);
    expect(saved.bodyFatPct).toBe(14.3);
    expect(saved.injuriesNotes).toBeNull();
    expect(await s.get.execute('u1')).toEqual(saved);
  });

  it('requires health data consent', async () => {
    await s.users.setHealthConsent('u1', null);
    await expect(s.upsert.execute('u1', profile)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      reason: 'HEALTH_CONSENT_REQUIRED',
    });
  });

  it('rejects grappling (disabled) and unknown sports', async () => {
    await expect(
      s.upsert.execute('u1', { ...profile, sports: [{ code: 'JUDO', level: 'BEGINNER' }] }),
    ).rejects.toMatchObject({ reason: 'UNKNOWN_SPORT', details: { codes: ['JUDO'] } });
  });

  it('requires at least one sport and rejects duplicates', async () => {
    await expect(s.upsert.execute('u1', { ...profile, sports: [] })).rejects.toMatchObject({
      reason: 'SPORT_REQUIRED',
    });
    await expect(
      s.upsert.execute('u1', {
        ...profile,
        sports: [
          { code: 'BOXING', level: 'BEGINNER' },
          { code: 'BOXING', level: 'ADVANCED' },
        ],
      }),
    ).rejects.toMatchObject({ reason: 'DUPLICATED_VALUES' });
  });

  it('validates ranges', async () => {
    await expect(s.upsert.execute('u1', { ...profile, daysPerWeek: 8 })).rejects.toMatchObject({
      reason: 'OUT_OF_RANGE',
      details: { field: 'daysPerWeek' },
    });
  });

  it('rejects unknown equipment', async () => {
    await expect(
      s.upsert.execute('u1', { ...profile, equipment: ['LASER'] }),
    ).rejects.toMatchObject({
      reason: 'UNKNOWN_EQUIPMENT',
    });
  });

  it('diet restrictions require premium', async () => {
    const withDiet = { ...profile, dietRestrictions: ['VEGAN' as const] };
    await expect(s.upsert.execute('u1', withDiet)).rejects.toMatchObject({
      code: 'PREMIUM_REQUIRED',
      reason: 'DIET_RESTRICTIONS',
    });
    s.entitlements.plans.set('u1', { tier: 'PREMIUM', addOns: [] });
    await expect(s.upsert.execute('u1', withDiet)).resolves.toMatchObject({
      dietRestrictions: ['VEGAN'],
    });
  });

  it('withdrawing consent deletes the profile', async () => {
    await s.upsert.execute('u1', profile);
    await s.users.setHealthConsent('u1', null);
    expect(await s.profiles.findByUserId('u1')).toBeNull();
  });
});

describe('GetAthleteProfile', () => {
  it('returns NOT_FOUND when there is no profile yet', async () => {
    await expect(s.get.execute('u1')).rejects.toMatchObject({ reason: 'PROFILE_NOT_FOUND' });
  });
});
