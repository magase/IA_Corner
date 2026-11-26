import { StrikingSports } from '@corner/shared';
import { describe, expect, it } from 'vitest';
import {
  EXERCISE_FILES,
  loadExercises,
  loadMenus,
  loadWiki,
  WIKI_FILES,
} from '../prisma/seed-data/load.js';
import { findForbiddenContent } from '../prisma/seed-data/schema.js';

const exercises = EXERCISE_FILES.flatMap((f) => loadExercises(f));
const wiki = WIKI_FILES.flatMap((f) => loadWiki(f));

describe('contenido del catálogo', () => {
  it('slugs únicos en ejercicios y en wiki', () => {
    const dup = (xs: string[]) => xs.filter((s, i) => xs.indexOf(s) !== i);
    expect(dup(exercises.map((e) => e.slug))).toEqual([]);
    expect(dup(wiki.map((w) => w.slug))).toEqual([]);
  });

  it('unos 60 ejercicios de gimnasio repartidos en las 4 categorías', () => {
    const gym = exercises.filter((e) => e.category !== 'SPORT_DRILL');
    expect(gym.length).toBeGreaterThanOrEqual(55);
    expect(gym.length).toBeLessThanOrEqual(70);
    for (const c of ['STRENGTH', 'PLYOMETRICS', 'MOBILITY', 'FLEXIBILITY']) {
      expect(gym.filter((e) => e.category === c).length, c).toBeGreaterThanOrEqual(10);
    }
  });

  it('al menos 10 drills en solitario por deporte de striking', () => {
    const drills = exercises.filter((e) => e.category === 'SPORT_DRILL');
    for (const sport of StrikingSports) {
      expect(drills.filter((d) => d.sports.includes(sport)).length, sport).toBeGreaterThanOrEqual(
        10,
      );
    }
    // Solo ejercicios realizables en solitario: nada de compañero ni sparring.
    // "sin compañero" / "without a partner" confirman que es en solitario: se permiten.
    const partner =
      /(?<!sin )compañero|pareja|sparring|(?<!without a )partner|pad holder|manoplas? (de|con) (tu )?entrenador/i;
    expect(drills.filter((d) => partner.test(JSON.stringify(d))).map((d) => d.slug)).toEqual([]);
  });

  it('la wiki cubre todas las categorías y suficientes suplementos', () => {
    const by = (c: string) => wiki.filter((w) => w.category === c).length;
    expect(by('MACRONUTRIENT')).toBeGreaterThanOrEqual(3);
    expect(by('MICRONUTRIENT')).toBeGreaterThanOrEqual(8);
    expect(by('HYDRATION')).toBeGreaterThanOrEqual(2);
    expect(by('SUPPLEMENT')).toBeGreaterThanOrEqual(10);
    expect(by('TRAINING_CONCEPT')).toBeGreaterThanOrEqual(6);
  });

  it('hay un menú genérico por cada objetivo', async () => {
    const { TrainingGoals } = await import('@corner/shared');
    expect(
      loadMenus()
        .map((m) => m.goal)
        .sort(),
    ).toEqual([...TrainingGoals].sort());
  });

  it('los suplementos que sugiere el plan nutricional existen en la wiki', async () => {
    const { suggestSupplements } = await import('../src/modules/nutrition/domain/nutrition.js');
    const slugs = new Set(wiki.filter((w) => w.category === 'SUPPLEMENT').map((w) => w.slug));
    const suggested = new Set(
      (
        [
          'GENERAL_FITNESS',
          'STRENGTH_POWER',
          'CONDITIONING',
          'TECHNIQUE',
          'BODY_COMPOSITION',
        ] as const
      ).flatMap((g) => suggestSupplements(g, 6).map((s) => s.slug)),
    );
    expect([...suggested].filter((s) => !slugs.has(s))).toEqual([]);
  });

  it('los artículos relacionados existen y no se enlazan a sí mismos', () => {
    const slugs = new Set(wiki.map((w) => w.slug));
    const broken = wiki.flatMap((w) =>
      w.related.filter((r) => !slugs.has(r) || r === w.slug).map((r) => `${w.slug} -> ${r}`),
    );
    expect(broken).toEqual([]);
  });

  it('no hay contenido de corte de peso ni rehidratación para el pesaje', () => {
    expect(findForbiddenContent([...exercises, ...wiki])).toEqual([]);
    expect(findForbiddenContent('Protocolo de corte de peso')).not.toEqual([]);
    expect(findForbiddenContent('how to make weight with water loading')).not.toEqual([]);
  });
});
