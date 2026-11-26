/**
 * Formato y validación del contenido del catálogo (ejercicios, drills y wiki).
 * Los ficheros JSON de esta carpeta se validan en los tests y antes de cada seed.
 */
import {
  Difficulties,
  Equipment,
  EvidenceLevels,
  ExerciseCategories,
  MeasureTypes,
  Muscles,
  StrikingSports,
  TrainingGoals,
  WadaStatuses,
  WikiCategories,
} from '@corner/shared';
import { z } from 'zod';

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const list = (minItems: number, maxItems: number, maxLen = 300) =>
  z.array(text(3, maxLen)).min(minItems).max(maxItems);
const slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug en kebab-case')
  .max(80);

const ExerciseI18n = z
  .object({
    name: text(2, 120),
    description: text(20, 1200),
    steps: list(3, 10),
    commonMistakes: list(2, 8),
    tips: list(1, 6),
  })
  .strict();

export const ExerciseSeed = z
  .object({
    slug,
    category: z.enum(ExerciseCategories),
    difficulty: z.enum(Difficulties),
    measureType: z.enum(MeasureTypes),
    primaryMuscles: z.array(z.enum(Muscles)).min(1).max(6),
    secondaryMuscles: z.array(z.enum(Muscles)).max(8),
    equipment: z.array(z.enum(Equipment)).min(1).max(4),
    /** Solo drills (SPORT_DRILL): deportes a los que pertenece. */
    sports: z.array(z.enum(StrikingSports)).max(5),
    defaults: z
      .object({
        sets: z.number().int().min(1).max(12).nullable(),
        reps: z
          .string()
          .regex(/^\d{1,3}(-\d{1,3})?$/)
          .nullable(),
        seconds: z.number().int().min(5).max(1800).nullable(),
        restSec: z.number().int().min(0).max(600).nullable(),
      })
      .strict(),
    i18n: z.object({ es: ExerciseI18n, en: ExerciseI18n }).strict(),
  })
  .strict()
  .superRefine((e, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (e.category === 'SPORT_DRILL' && e.sports.length === 0) issue('un drill necesita deporte');
    if (e.category !== 'SPORT_DRILL' && e.sports.length > 0) issue('solo los drills llevan sports');
    if (e.measureType === 'REPS' && !e.defaults.reps) issue('REPS requiere defaults.reps');
    if (['TIME', 'ROUNDS'].includes(e.measureType) && !e.defaults.seconds) {
      issue(`${e.measureType} requiere defaults.seconds`);
    }
    if (e.measureType === 'ROUNDS' && !e.defaults.sets)
      issue('ROUNDS requiere defaults.sets (rounds)');
    if (e.primaryMuscles.some((m) => e.secondaryMuscles.includes(m))) {
      issue('un músculo no puede ser primario y secundario');
    }
    if (e.equipment.includes('NONE') && e.equipment.length > 1) issue('NONE no se combina');
  });
export type ExerciseSeed = z.infer<typeof ExerciseSeed>;

const Source = z
  .object({ title: text(3, 200), url: z.string().url().startsWith('https://') })
  .strict();

const ArticleI18n = z
  .object({
    title: text(2, 150),
    summary: text(20, 500),
    /** Markdown. */
    body: text(200, 12000),
  })
  .strict();

const SupplementI18n = z
  .object({
    whatItIs: text(20, 1500),
    purpose: text(20, 1500),
    dosage: text(5, 500),
    timing: text(5, 500),
    sideEffects: text(10, 1500),
  })
  .strict();

export const WikiSeed = z
  .object({
    slug,
    category: z.enum(WikiCategories),
    sources: z.array(Source).min(1).max(8),
    /** Artículos relacionados (slugs de esta wiki). */
    related: z.array(slug).max(8),
    i18n: z.object({ es: ArticleI18n, en: ArticleI18n }).strict(),
    supplement: z
      .object({
        evidenceLevel: z.enum(EvidenceLevels),
        wadaStatus: z.enum(WadaStatuses),
        i18n: z.object({ es: SupplementI18n, en: SupplementI18n }).strict(),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .superRefine((w, ctx) => {
    if ((w.category === 'SUPPLEMENT') !== (w.supplement !== null)) {
      ctx.addIssue({
        code: 'custom',
        message: 'supplement solo (y siempre) en categoría SUPPLEMENT',
      });
    }
  });
export type WikiSeed = z.infer<typeof WikiSeed>;

const MenuSection = z.enum([
  'BREAKFAST',
  'MID_MORNING',
  'LUNCH',
  'SNACK',
  'PRE_WORKOUT',
  'POST_WORKOUT',
  'DINNER',
  'HYDRATION',
]);
const MenuI18n = z
  .object({ title: text(3, 120), content: z.partialRecord(MenuSection, list(1, 6)) })
  .strict();

/** Menú genérico por objetivo (plan nutricional gratuito). */
export const MenuSeed = z
  .object({
    code: slug,
    goal: z.enum(TrainingGoals),
    i18n: z.object({ es: MenuI18n, en: MenuI18n }).strict(),
  })
  .strict()
  .superRefine((m, ctx) => {
    const es = Object.keys(m.i18n.es.content).sort().join();
    const en = Object.keys(m.i18n.en.content).sort().join();
    if (es !== en)
      ctx.addIssue({ code: 'custom', message: 'es y en deben tener las mismas secciones' });
  });
export type MenuSeed = z.infer<typeof MenuSeed>;

/** Contenido excluido por decisión de producto: protocolos de corte de peso / rehidratación. */
const FORBIDDEN = [
  /corte de peso/i,
  /cortar peso/i,
  /weight[- ]?cut/i,
  /cutting weight/i,
  /making weight/i,
  /deshidrata\w* (para|antes de)/i,
  /dehydrat\w* (to|before)/i,
  /water ?loading/i,
  /carga de agua/i,
  /rehidrata\w* (tras|después de|post)[- ]?(el )?pesaje/i,
  /rehydrat\w* after (the )?weigh/i,
];

export function findForbiddenContent(value: unknown, path = '$'): string[] {
  if (typeof value === 'string') {
    return FORBIDDEN.filter((re) => re.test(value)).map((re) => `${path}: ${re}`);
  }
  if (Array.isArray(value))
    return value.flatMap((v, i) => findForbiddenContent(v, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => findForbiddenContent(v, `${path}.${k}`));
  }
  return [];
}
