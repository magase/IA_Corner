import type { PrismaClient } from '@prisma/client';
import {
  EXERCISE_FILES,
  loadExercises,
  loadMenus,
  loadWiki,
  WIKI_FILES,
} from './seed-data/load.js';
import type { ExerciseSeed, WikiSeed } from './seed-data/schema.js';

const LOCALES = ['es', 'en'] as const;

async function upsertExercise(
  db: PrismaClient,
  e: ExerciseSeed,
  ids: { sport: Map<string, string>; equipment: Map<string, string> },
) {
  const data = {
    category: e.category,
    difficulty: e.difficulty,
    measureType: e.measureType,
    primaryMuscles: e.primaryMuscles,
    secondaryMuscles: e.secondaryMuscles,
    defaultSets: e.defaults.sets,
    defaultReps: e.defaults.reps,
    defaultSeconds: e.defaults.seconds,
    defaultRestSec: e.defaults.restSec,
    isActive: true,
  };
  const need = (m: Map<string, string>, code: string) => {
    const id = m.get(code);
    if (!id)
      throw new Error(`${e.slug}: código de catálogo desconocido ${code} (¿falta el seed base?)`);
    return id;
  };
  await db.$transaction(async (tx) => {
    const row = await tx.exercise.upsert({
      where: { slug: e.slug },
      create: { slug: e.slug, ...data },
      update: data,
    });
    for (const locale of LOCALES) {
      const t = e.i18n[locale];
      const tr = {
        name: t.name,
        description: t.description,
        steps: t.steps,
        commonMistakes: t.commonMistakes,
        tips: t.tips,
      };
      await tx.exerciseTranslation.upsert({
        where: { exerciseId_locale: { exerciseId: row.id, locale } },
        create: { exerciseId: row.id, locale, ...tr },
        update: tr,
      });
    }
    await tx.exerciseEquipment.deleteMany({ where: { exerciseId: row.id } });
    await tx.exerciseEquipment.createMany({
      data: e.equipment.map((c) => ({ exerciseId: row.id, equipmentId: need(ids.equipment, c) })),
    });
    await tx.exerciseSport.deleteMany({ where: { exerciseId: row.id } });
    if (e.sports.length) {
      await tx.exerciseSport.createMany({
        data: e.sports.map((c) => ({ exerciseId: row.id, sportId: need(ids.sport, c) })),
      });
    }
  });
}

async function upsertArticle(db: PrismaClient, w: WikiSeed) {
  await db.$transaction(async (tx) => {
    const row = await tx.wikiArticle.upsert({
      where: { slug: w.slug },
      create: { slug: w.slug, category: w.category, related: w.related, isPublished: true },
      update: { category: w.category, related: w.related, isPublished: true },
    });
    for (const locale of LOCALES) {
      const t = w.i18n[locale];
      const tr = { title: t.title, summary: t.summary, body: t.body, sources: w.sources };
      await tx.wikiArticleTranslation.upsert({
        where: { articleId_locale: { articleId: row.id, locale } },
        create: { articleId: row.id, locale, ...tr },
        update: tr,
      });
    }
    if (!w.supplement) {
      // El artículo ya no es un suplemento: se quitan antes sus sugerencias en planes (FK Restrict).
      await tx.nutritionPlanSupplement.deleteMany({ where: { supplement: { articleId: row.id } } });
      await tx.supplement.deleteMany({ where: { articleId: row.id } });
      return;
    }
    const s = w.supplement;
    const sup = await tx.supplement.upsert({
      where: { articleId: row.id },
      create: { articleId: row.id, evidenceLevel: s.evidenceLevel, wadaStatus: s.wadaStatus },
      update: { evidenceLevel: s.evidenceLevel, wadaStatus: s.wadaStatus },
    });
    for (const locale of LOCALES) {
      const t = s.i18n[locale];
      await tx.supplementTranslation.upsert({
        where: { supplementId_locale: { supplementId: sup.id, locale } },
        create: { supplementId: sup.id, locale, ...t },
        update: t,
      });
    }
  });
}

/** Importa ejercicios, drills y wiki. Lo que ya no está en los JSON se despublica (no se borra). */
export async function seedContent(
  db: PrismaClient,
): Promise<{ exercises: number; articles: number }> {
  const exercises = EXERCISE_FILES.flatMap((f) => loadExercises(f));
  const wiki = WIKI_FILES.flatMap((f) => loadWiki(f));

  const [sports, equipment] = await Promise.all([
    db.sport.findMany({ select: { id: true, code: true } }),
    db.equipment.findMany({ select: { id: true, code: true } }),
  ]);
  const ids = {
    sport: new Map(sports.map((s) => [s.code, s.id])),
    equipment: new Map(equipment.map((e) => [e.code, e.id])),
  };

  for (const e of exercises) await upsertExercise(db, e, ids);
  for (const w of wiki) await upsertArticle(db, w);
  for (const m of loadMenus()) {
    const row = await db.menuTemplate.upsert({
      where: { code: m.code },
      create: { code: m.code, goal: m.goal },
      update: { goal: m.goal },
    });
    for (const locale of LOCALES) {
      const t = m.i18n[locale];
      await db.menuTemplateTranslation.upsert({
        where: { menuTemplateId_locale: { menuTemplateId: row.id, locale } },
        create: { menuTemplateId: row.id, locale, title: t.title, content: t.content },
        update: { title: t.title, content: t.content },
      });
    }
  }

  await db.exercise.updateMany({
    where: { slug: { notIn: exercises.map((e) => e.slug) } },
    data: { isActive: false },
  });
  await db.wikiArticle.updateMany({
    where: { slug: { notIn: wiki.map((w) => w.slug) } },
    data: { isPublished: false },
  });
  return { exercises: exercises.length, articles: wiki.length };
}
