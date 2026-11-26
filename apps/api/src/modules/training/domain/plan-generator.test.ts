import { describe, expect, it } from 'vitest';
import { CANDIDATES } from '../../../../test/fakes/candidates.js';
import { generateTrainingPlan, mainCount, type GeneratorInput } from './plan-generator.js';

const base: GeneratorInput = {
  goal: 'GENERAL_FITNESS',
  level: 'BEGINNER',
  daysPerWeek: 4,
  sessionMinutes: 60,
  sports: ['MUAY_THAI'],
  equipment: ['NONE'],
};
const slugs = (p: ReturnType<typeof generateTrainingPlan>) =>
  p.sessions.flatMap((s) => s.exercises.map((e) => e.slug));

describe('generateTrainingPlan', () => {
  it('is deterministic', () => {
    expect(generateTrainingPlan(base, CANDIDATES)).toEqual(
      generateTrainingPlan(base, [...CANDIDATES].reverse()),
    );
  });

  it('creates one session per available day with distinct weekdays', () => {
    for (let d = 1; d <= 7; d++) {
      const p = generateTrainingPlan({ ...base, daysPerWeek: d }, CANDIDATES);
      expect(p.sessions).toHaveLength(d);
      expect(new Set(p.sessions.map((s) => s.dayOfWeek)).size).toBe(d);
      expect(p.name).toBe(`GENERAL_FITNESS_${d}D`);
    }
  });

  it('never schedules heavy lower body and power on consecutive days', () => {
    for (let d = 1; d <= 7; d++) {
      const s = generateTrainingPlan({ ...base, daysPerWeek: d }, CANDIDATES).sessions;
      const heavy = s
        .filter((x) => ['STRENGTH_LOWER', 'POWER', 'STRENGTH_FULL'].includes(x.focus))
        .map((x) => x.dayOfWeek);
      for (let i = 1; i < heavy.length; i++) expect(heavy[i]! - heavy[i - 1]!).toBeGreaterThan(1);
    }
  });

  it('respects available equipment (bodyweight always allowed)', () => {
    const p = generateTrainingPlan(base, CANDIDATES);
    expect(slugs(p)).not.toContain('goblet-squat');
    expect(slugs(p)).not.toContain('pull-up');
    const withDb = generateTrainingPlan({ ...base, equipment: ['DUMBBELLS'] }, CANDIDATES);
    expect(slugs(withDb)).toContain('goblet-squat');
  });

  it('FULL_GYM unlocks all equipment', () => {
    const p = generateTrainingPlan(
      { ...base, level: 'ADVANCED', equipment: ['FULL_GYM'] },
      CANDIDATES,
    );
    const needsGear = CANDIDATES.filter((c) => !c.equipment.includes('NONE')).map((c) => c.slug);
    expect(slugs(p).filter((s) => needsGear.includes(s)).length).toBeGreaterThanOrEqual(2);
  });

  it('respects difficulty by level', () => {
    const beginner = slugs(generateTrainingPlan({ ...base, equipment: ['FULL_GYM'] }, CANDIDATES));
    expect(beginner).not.toContain('nordic-curl');
    expect(beginner).not.toContain('barbell-deadlift');
  });

  it('only uses drills from the user sports, round-robin across several', () => {
    const one = slugs(generateTrainingPlan(base, CANDIDATES)).filter((s) => s.includes('-'));
    expect(one.some((s) => s.startsWith('boxing-'))).toBe(false);
    expect(one).not.toContain('judo-uchikomi');
    const both = slugs(
      generateTrainingPlan({ ...base, sports: ['MUAY_THAI', 'BOXING'] }, CANDIDATES),
    );
    expect(both.some((s) => s.startsWith('boxing-'))).toBe(true);
    expect(both.some((s) => s.startsWith('muay-thai-'))).toBe(true);
  });

  it('does not repeat an exercise inside the same session', () => {
    for (const s of generateTrainingPlan({ ...base, daysPerWeek: 7 }, CANDIDATES).sessions) {
      const list = s.exercises.map((e) => e.slug);
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it('every session has warm-up/main and ends with mobility or flexibility work', () => {
    for (const s of generateTrainingPlan({ ...base, daysPerWeek: 5 }, CANDIDATES).sessions) {
      expect(s.exercises.some((e) => e.block === 'MAIN')).toBe(true);
      expect(s.exercises.at(-1)?.block).toBe('COOLDOWN');
    }
  });

  it('scales main volume with session length', () => {
    expect(mainCount(30)).toBe(2);
    expect(mainCount(60)).toBe(4);
    expect(mainCount(240)).toBe(6);
  });

  it('adapts prescription to the goal', () => {
    const strength = generateTrainingPlan(
      { ...base, goal: 'STRENGTH_POWER', level: 'INTERMEDIATE', equipment: ['DUMBBELLS'] },
      CANDIDATES,
    );
    const all = strength.sessions.flatMap((s) => s.exercises);
    // Solo los compuestos con carga pasan a fuerza máxima…
    const loaded = all.find((e) => e.slug === 'goblet-squat');
    expect(loaded?.reps).toBe('4-6');
    expect(loaded?.restSec).toBeGreaterThanOrEqual(150);
    // …el peso corporal, el core y los gemelos conservan su prescripción por defecto.
    for (const slug of ['push-up', 'dead-bug', 'calf-raise', 'split-squat']) {
      const e = all.find((x) => x.slug === slug);
      if (e) expect(e.reps, slug).toBe('8-12');
    }

    const cond = generateTrainingPlan({ ...base, goal: 'CONDITIONING' }, CANDIDATES);
    expect(cond.sessions.map((s) => s.focus)).not.toContain('SPORT_TECHNIQUE');
    const tech = generateTrainingPlan({ ...base, goal: 'TECHNIQUE' }, CANDIDATES);
    expect(tech.sessions.map((s) => s.focus)).not.toContain('SPORT_CONDITIONING');
  });

  it('drills are prescribed in rounds', () => {
    const drill = generateTrainingPlan(base, CANDIDATES)
      .sessions.flatMap((s) => s.exercises)
      .find((e) => e.slug.startsWith('muay-thai-'));
    expect(drill).toMatchObject({
      rounds: expect.any(Number),
      seconds: 180,
      sets: null,
      reps: null,
    });
  });

  it('falls back to another focus instead of dropping a day', () => {
    const lower = ['QUADRICEPS', 'GLUTES', 'HAMSTRINGS', 'CALVES'];
    const noLowerBodyweight = CANDIDATES.filter(
      (c) =>
        !(
          c.category === 'STRENGTH' &&
          c.equipment.includes('NONE') &&
          c.primaryMuscles.some((m) => lower.includes(m))
        ),
    );
    const p = generateTrainingPlan({ ...base, daysPerWeek: 5 }, noLowerBodyweight);
    expect(p.sessions).toHaveLength(5);
    expect(p.name).toBe('GENERAL_FITNESS_5D');
    expect(p.sessions.find((s) => s.dayOfWeek === 1)?.focus).not.toBe('STRENGTH_LOWER');
  });

  it('never schedules plyometrics on consecutive days (any goal, any days)', () => {
    const plyo = new Set(CANDIDATES.filter((c) => c.category === 'PLYOMETRICS').map((c) => c.slug));
    for (const goal of [
      'GENERAL_FITNESS',
      'STRENGTH_POWER',
      'CONDITIONING',
      'TECHNIQUE',
      'BODY_COMPOSITION',
    ] as const) {
      for (let d = 1; d <= 7; d++) {
        const days = generateTrainingPlan(
          { ...base, goal, level: 'ADVANCED', daysPerWeek: d },
          CANDIDATES,
        )
          .sessions.filter((s) => s.exercises.some((e) => plyo.has(e.slug) && e.block !== 'WARMUP'))
          .map((s) => s.dayOfWeek);
        for (let i = 1; i < days.length; i++)
          expect(days[i]! - days[i - 1]!, `${goal} ${d}d`).toBeGreaterThan(1);
      }
    }
  });

  it('fits drill rounds into the available session time', () => {
    for (const minutes of [30, 45, 60, 90]) {
      const p = generateTrainingPlan(
        {
          ...base,
          goal: 'CONDITIONING',
          level: 'INTERMEDIATE',
          daysPerWeek: 4,
          sessionMinutes: minutes,
        },
        CANDIDATES,
      );
      for (const s of p.sessions) {
        const roundsSec = s.exercises
          .filter((e) => e.rounds !== null)
          .reduce((t, e) => t + e.rounds! * e.seconds! + (e.rounds! - 1) * (e.restSec ?? 0), 0);
        expect(roundsSec / 60, `${minutes} min ${s.focus}`).toBeLessThanOrEqual(
          Math.max(minutes - 14, 16) + 1,
        );
      }
    }
  });

  it('neck and forearm work never take an upper-body main slot', () => {
    const neck = [
      ...CANDIDATES,
      { ...CANDIDATES[6]!, slug: 'aaa-neck-iso', primaryMuscles: ['NECK' as const] },
    ];
    const p = generateTrainingPlan({ ...base, daysPerWeek: 3, sessionMinutes: 30 }, neck);
    expect(p.sessions.flatMap((s) => s.exercises).map((e) => e.slug)).not.toContain('aaa-neck-iso');
  });

  it('power days start with a low-intensity plyometric warm-up and region-specific mobility', () => {
    const p = generateTrainingPlan({ ...base, level: 'ADVANCED', daysPerWeek: 3 }, CANDIDATES);
    const power = p.sessions.find((s) => s.focus === 'POWER')!;
    const warm = power.exercises.filter((e) => e.block === 'WARMUP');
    const beginnerPlyo = CANDIDATES.filter(
      (c) => c.category === 'PLYOMETRICS' && c.difficulty === 'BEGINNER',
    ).map((c) => c.slug);
    expect(warm.some((e) => beginnerPlyo.includes(e.slug))).toBe(true);
    // Movilidad de tren inferior antes que de hombro en un día de potencia de piernas.
    const mob = warm.filter((e) => !beginnerPlyo.includes(e.slug)).map((e) => e.slug);
    expect(mob[0]).not.toBe('shoulder-cars');
  });

  it('degrades gracefully with an empty catalog', () => {
    expect(generateTrainingPlan(base, []).sessions).toEqual([]);
  });
});
