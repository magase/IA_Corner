import type {
  EquipmentDto,
  ExerciseDetailDto,
  Locale,
  SportDto,
  WikiArticleDto,
  WikiSummaryDto,
} from '@corner/shared';
import type { CatalogQueries } from '../../src/modules/catalog/application/ports.js';
import type {
  ExerciseFilter,
  Pagination,
  WikiFilter,
} from '../../src/modules/catalog/domain/catalog-filters.js';

type StoredArticle = Omit<WikiArticleDto, 'related' | 'requiresHealthDisclaimer'> & {
  relatedSlugs: string[];
};

/** Catálogo en memoria (un solo idioma por elemento; suficiente para tests). */
export class InMemoryCatalogQueries implements CatalogQueries {
  sports: SportDto[] = [
    { code: 'BOXING', category: 'STRIKING', name: 'Boxeo', description: 'Puños' },
    { code: 'MUAY_THAI', category: 'STRIKING', name: 'Muay Thai', description: '8 armas' },
  ];
  equipment: EquipmentDto[] = [
    { code: 'NONE', name: 'Sin material' },
    { code: 'DUMBBELLS', name: 'Mancuernas' },
  ];
  exercises: ExerciseDetailDto[] = [];
  articles: StoredArticle[] = [];
  lastLocale: Locale | null = null;

  async listSports(locale: Locale) {
    this.lastLocale = locale;
    return this.sports;
  }
  async listEquipment(locale: Locale) {
    this.lastLocale = locale;
    return this.equipment;
  }
  async listExercises(f: ExerciseFilter, p: Pagination, locale: Locale) {
    this.lastLocale = locale;
    const all = this.exercises.filter(
      (e) =>
        (!f.category || e.category === f.category) &&
        (!f.difficulty || e.difficulty === f.difficulty) &&
        (!f.sport || e.sports.includes(f.sport)) &&
        (!f.availableEquipment || e.equipment.every((x) => f.availableEquipment!.includes(x))) &&
        (!f.search || e.name.toLowerCase().includes(f.search.toLowerCase())),
    );
    const items = all.slice((p.page - 1) * p.pageSize, p.page * p.pageSize).map((e) => ({
      slug: e.slug,
      name: e.name,
      category: e.category,
      difficulty: e.difficulty,
      measureType: e.measureType,
      primaryMuscles: e.primaryMuscles,
      equipment: e.equipment,
      sports: e.sports,
      thumbnailUrl: e.thumbnailUrl,
    }));
    return { items, page: p.page, pageSize: p.pageSize, total: all.length };
  }
  async getExercise(slug: string) {
    return this.exercises.find((e) => e.slug === slug) ?? null;
  }
  async listWiki(f: WikiFilter) {
    return this.articles
      .filter(
        (a) =>
          (!f.category || a.category === f.category) && (!f.search || a.title.includes(f.search)),
      )
      .map(summary);
  }
  async getWikiArticle(slug: string) {
    return this.articles.find((a) => a.slug === slug) ?? null;
  }
  async getWikiSummaries(slugs: string[]) {
    return this.articles.filter((a) => slugs.includes(a.slug)).map(summary);
  }
}

const summary = (a: StoredArticle): WikiSummaryDto => ({
  slug: a.slug,
  category: a.category,
  title: a.title,
  summary: a.summary,
});

export function exercise(over: Partial<ExerciseDetailDto> & { slug: string }): ExerciseDetailDto {
  return {
    name: over.slug,
    category: 'STRENGTH',
    difficulty: 'BEGINNER',
    measureType: 'REPS',
    primaryMuscles: ['QUADRICEPS'],
    secondaryMuscles: [],
    equipment: ['NONE'],
    sports: [],
    thumbnailUrl: null,
    description: 'desc',
    steps: ['a', 'b', 'c'],
    commonMistakes: ['x', 'y'],
    tips: ['t'],
    defaults: { sets: 3, reps: '8-12', seconds: null, restSec: 90 },
    media: null,
    ...over,
  };
}

export function article(over: Partial<StoredArticle> & { slug: string }): StoredArticle {
  return {
    category: 'TRAINING_CONCEPT',
    title: over.slug,
    summary: 'resumen',
    locale: 'es',
    body: '## cuerpo',
    sources: [],
    relatedSlugs: [],
    supplement: null,
    updatedAt: new Date(0).toISOString(),
    ...over,
  };
}
