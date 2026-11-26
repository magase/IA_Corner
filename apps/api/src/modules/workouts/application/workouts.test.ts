import { beforeEach, describe, expect, it } from 'vitest';
import { FixedClock, InMemoryEntitlements } from '../../../../test/fakes/index.js';
import { InMemoryWorkouts } from '../../../../test/fakes/plans.js';
import type { WorkoutLogInput } from '../domain/workout.js';
import { WorkoutService } from './workout-use-cases.js';

const clock = new FixedClock(new Date('2026-11-26T10:00:00Z'));
const log = (over: Partial<WorkoutLogInput> = {}): WorkoutLogInput => ({
  performedAt: new Date('2026-11-25T18:00:00Z'),
  sessionId: null,
  durationMin: 60,
  rpe: 7,
  feeling: 4,
  notes: '  buena sesión ',
  entries: [
    {
      exerciseSlug: 'push-up',
      setIndex: 1,
      reps: 12,
      weightKg: null,
      seconds: null,
      rounds: null,
      rpe: 7,
    },
  ],
  ...over,
});

let repo: InMemoryWorkouts;
let ent: InMemoryEntitlements;
let svc: WorkoutService;
beforeEach(() => {
  repo = new InMemoryWorkouts();
  ent = new InMemoryEntitlements();
  svc = new WorkoutService(repo, ent, clock);
});

describe('WorkoutService', () => {
  it('free tier: 10 rows max, then PREMIUM_REQUIRED with details', async () => {
    for (let i = 0; i < 10; i++) await svc.log('u1', log(), 'es');
    await expect(svc.log('u1', log(), 'es')).rejects.toMatchObject({
      code: 'PREMIUM_REQUIRED',
      reason: 'WORKOUT_LOG_LIMIT',
      details: { limit: 10, used: 10 },
    });
    // Los límites son por usuario.
    await expect(svc.log('u2', log(), 'es')).resolves.toBeTruthy();
  });

  it('deleting frees space; delete all empties the history', async () => {
    const ids = [];
    for (let i = 0; i < 10; i++) ids.push((await svc.log('u1', log(), 'es')).id);
    await svc.delete('u1', ids[0]!);
    await expect(svc.log('u1', log(), 'es')).resolves.toBeTruthy();
    expect(await svc.deleteAll('u1')).toEqual({ deleted: 10 });
    expect(await svc.history('u1', 1, 20)).toMatchObject({ total: 0, limit: 10 });
  });

  it('premium has no limit', async () => {
    ent.plans.set('u1', { tier: 'PREMIUM', addOns: [] });
    for (let i = 0; i < 12; i++) await svc.log('u1', log(), 'es');
    expect((await svc.history('u1', 1, 50)).limit).toBeNull();
  });

  it('cannot read or delete other users logs', async () => {
    const w = await svc.log('u1', log(), 'es');
    await expect(svc.get('u2', w.id, 'es')).rejects.toMatchObject({ reason: 'WORKOUT_NOT_FOUND' });
    await expect(svc.delete('u2', w.id)).rejects.toMatchObject({ reason: 'WORKOUT_NOT_FOUND' });
  });

  it('validates the log', async () => {
    await expect(svc.log('u1', log({ rpe: 11 }), 'es')).rejects.toMatchObject({
      reason: 'OUT_OF_RANGE',
    });
    await expect(
      svc.log('u1', log({ performedAt: new Date('2030-01-01') }), 'es'),
    ).rejects.toMatchObject({
      reason: 'INVALID_PERFORMED_AT',
    });
    await expect(
      svc.log(
        'u1',
        log({
          entries: [
            {
              exerciseSlug: 'push-up',
              setIndex: 1,
              reps: null,
              weightKg: null,
              seconds: null,
              rounds: null,
              rpe: null,
            },
          ],
        }),
        'es',
      ),
    ).rejects.toMatchObject({ reason: 'EMPTY_ENTRY' });
    await expect(
      svc.log(
        'u1',
        log({
          entries: [
            {
              exerciseSlug: 'ghost',
              setIndex: 1,
              reps: 5,
              weightKg: null,
              seconds: null,
              rounds: null,
              rpe: null,
            },
          ],
        }),
        'es',
      ),
    ).rejects.toMatchObject({ reason: 'UNKNOWN_EXERCISE' });
    const saved = await svc.log('u1', log(), 'es');
    expect(saved.notes).toBe('buena sesión');
  });
});
