import type {
  Difficulty,
  ExerciseDetailDto,
  EquipmentType,
  EvidenceLevel,
  ExerciseCategory,
  Locale,
  MeasureType,
  Muscle,
  WadaStatus,
  WikiCategory,
  WikiSummaryDto,
} from '@corner/shared';
import { DEFAULT_LOCALE } from '@corner/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { CatalogQueries } from '../application/ports.js';
import type { ExerciseFilter, Pagination, WikiFilter } from '../domain/catalog-filters.js';

/** Elige la traducción del idioma pedido o, si falta, la del idioma por defecto. */
function pick<T extends { locale: string }>(rows: T[], locale: Locale): T | undefined {
  return rows.find((r) => r.locale === locale) ?? rows.find((r) => r.locale === DEFAULT_LOCALE);
}

const strings = (v: Prisma.JsonValue | null): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

const localesFor = (locale: Locale) => ({ locale: { in: [locale, DEFAULT_LOCALE] } });

const exerciseInclude = (locale: Locale) =>
  ({
    translations: { where: localesFor(locale) },
    equipment: { include: { equipment: { select: { code: true } } } },
    sports: { include: { sport: { select: { code: true } } } },
  }) satisfies Prisma.ExerciseInclude;

type ExerciseRow = Prisma.ExerciseGetPayload<{ include: ReturnType<typeof exerciseInclude> }>;

function toSummary(e: ExerciseRow, locale: Locale) {
  const t = pick(e.translations, locale);
  return {
    slug: e.slug,
    name: t?.name ?? e.slug,
    category: e.category as ExerciseCategory,
    difficulty: e.difficulty as Difficulty,
    measureType: e.measureType as MeasureType,
    primaryMuscles: strings(e.primaryMuscles) as Muscle[],
    equipment: e.equipment.map((x) => x.equipment.code as EquipmentType),
    sports: e.sports.map((s) => s.sport.code),
    thumbnailUrl: e.thumbnailUrl,
  };
}

export class PrismaCatalogQueries implements CatalogQueries {
  constructor(private readonly db: PrismaClient) {}

  async listSports(locale: Locale) {
    const rows = await this.db.sport.findMany({
      where: { isEnabled: true },
      include: { translations: { where: localesFor(locale) } },
      orderBy: { code: 'asc' },
    });
    return rows.map((s) => {
      const t = pick(s.translations, locale);
      return {
        code: s.code,
        category: s.category,
        name: t?.name ?? s.code,
        description: t?.description ?? '',
      };
    });
  }

  async listEquipment(locale: Locale) {
    const rows = await this.db.equipment.findMany({
      include: { translations: { where: localesFor(locale) } },
      orderBy: { code: 'asc' },
    });
    return rows.map((e) => ({
      code: e.code as EquipmentType,
      name: pick(e.translations, locale)?.name ?? e.code,
    }));
  }

  async listExercises(f: ExerciseFilter, p: Pagination, locale: Locale) {
    const where: Prisma.ExerciseWhereInput = {
      isActive: true,
      ...(f.category && { category: f.category }),
      ...(f.difficulty && { difficulty: f.difficulty }),
      // Drills solo de deportes activos (grappling no aparece).
      ...(f.sport
        ? { sports: { some: { sport: { code: f.sport, isEnabled: true } } } }
        : {
            OR: [
              { category: { not: 'SPORT_DRILL' } },
              { sports: { some: { sport: { isEnabled: true } } } },
            ],
          }),
      ...(f.availableEquipment && {
        equipment: { every: { equipment: { code: { in: f.availableEquipment } } } },
      }),
      ...(f.search && {
        translations: {
          some: { locale: { in: [locale, DEFAULT_LOCALE] }, name: { contains: f.search } },
        },
      }),
    };
    const [total, rows] = await this.db.$transaction([
      this.db.exercise.count({ where }),
      this.db.exercise.findMany({
        where,
        include: exerciseInclude(locale),
        orderBy: [{ category: 'asc' }, { difficulty: 'asc' }, { slug: 'asc' }],
        skip: (p.page - 1) * p.pageSize,
        take: p.pageSize,
      }),
    ]);
    return {
      items: rows.map((r) => toSummary(r, locale)),
      page: p.page,
      pageSize: p.pageSize,
      total,
    };
  }

  async getExercise(slug: string, locale: Locale): Promise<ExerciseDetailDto | null> {
    const e = await this.db.exercise.findFirst({
      where: { slug, isActive: true },
      include: exerciseInclude(locale),
    });
    if (!e) return null;
    const t = pick(e.translations, locale);
    const mediaType =
      e.mediaType === 'video' || e.mediaType === 'gif' || e.mediaType === 'image'
        ? e.mediaType
        : null;
    return {
      ...toSummary(e, locale),
      description: t?.description ?? '',
      steps: strings(t?.steps ?? null),
      commonMistakes: strings(t?.commonMistakes ?? null),
      tips: strings(t?.tips ?? null),
      secondaryMuscles: strings(e.secondaryMuscles) as Muscle[],
      defaults: {
        sets: e.defaultSets,
        reps: e.defaultReps,
        seconds: e.defaultSeconds,
        restSec: e.defaultRestSec,
      },
      media: e.mediaUrl && mediaType ? { url: e.mediaUrl, type: mediaType } : null,
    };
  }

  async listWiki(f: WikiFilter, locale: Locale) {
    const rows = await this.db.wikiArticle.findMany({
      where: {
        isPublished: true,
        ...(f.category && { category: f.category }),
        ...(f.search && {
          translations: {
            some: {
              locale: { in: [locale, DEFAULT_LOCALE] },
              OR: [{ title: { contains: f.search } }, { summary: { contains: f.search } }],
            },
          },
        }),
      },
      include: {
        translations: {
          where: localesFor(locale),
          select: { locale: true, title: true, summary: true },
        },
      },
      orderBy: [{ category: 'asc' }, { slug: 'asc' }],
    });
    return rows.map((a) => this.toWikiSummary(a, locale));
  }

  async getWikiSummaries(slugs: string[], locale: Locale) {
    const rows = await this.db.wikiArticle.findMany({
      where: { slug: { in: slugs }, isPublished: true },
      include: {
        translations: {
          where: localesFor(locale),
          select: { locale: true, title: true, summary: true },
        },
      },
    });
    return rows.map((a) => this.toWikiSummary(a, locale));
  }

  async getWikiArticle(slug: string, locale: Locale) {
    const a = await this.db.wikiArticle.findFirst({
      where: { slug, isPublished: true },
      include: {
        translations: { where: localesFor(locale) },
        supplement: { include: { translations: { where: localesFor(locale) } } },
      },
    });
    if (!a) return null;
    const t = pick(a.translations, locale);
    const st = a.supplement ? pick(a.supplement.translations, locale) : undefined;
    const sources = Array.isArray(t?.sources)
      ? (t.sources as { title?: unknown; url?: unknown }[])
          .filter((x) => typeof x?.title === 'string' && typeof x?.url === 'string')
          .map((x) => ({ title: x.title as string, url: x.url as string }))
      : [];
    return {
      slug: a.slug,
      category: a.category as WikiCategory,
      title: t?.title ?? a.slug,
      summary: t?.summary ?? '',
      locale: (t?.locale === 'en' ? 'en' : 'es') as Locale,
      body: t?.body ?? '',
      sources,
      relatedSlugs: strings(a.related),
      supplement:
        a.supplement && st
          ? {
              evidenceLevel: a.supplement.evidenceLevel as EvidenceLevel,
              wadaStatus: a.supplement.wadaStatus as WadaStatus,
              whatItIs: st.whatItIs,
              purpose: st.purpose,
              dosage: st.dosage,
              timing: st.timing,
              sideEffects: st.sideEffects,
            }
          : null,
      updatedAt: a.updatedAt.toISOString(),
    };
  }

  private toWikiSummary(
    a: {
      slug: string;
      category: string;
      translations: { locale: string; title: string; summary: string }[];
    },
    locale: Locale,
  ): WikiSummaryDto {
    const t = pick(a.translations, locale);
    return {
      slug: a.slug,
      category: a.category as WikiCategory,
      title: t?.title ?? a.slug,
      summary: t?.summary ?? '',
    };
  }
}
