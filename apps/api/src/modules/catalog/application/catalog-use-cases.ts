import type {
  Difficulty,
  EquipmentType,
  ExerciseCategory,
  Locale,
  WikiArticleDto,
  WikiCategory,
} from '@corner/shared';
import { NotFoundError } from '../../../shared/domain/errors.js';
import {
  normalizeEquipment,
  normalizePagination,
  normalizeSearch,
  requiresHealthDisclaimer,
} from '../domain/catalog-filters.js';
import type { CatalogQueries } from './ports.js';

export interface ListExercisesInput {
  category: ExerciseCategory | null;
  difficulty: Difficulty | null;
  sport: string | null;
  equipment: EquipmentType[] | null;
  q: string | null;
  page: number | null;
  pageSize: number | null;
}

export class CatalogService {
  constructor(private readonly queries: CatalogQueries) {}

  async listSports(locale: Locale) {
    return this.queries.listSports(locale);
  }

  async listEquipment(locale: Locale) {
    return this.queries.listEquipment(locale);
  }

  async listExercises(input: ListExercisesInput, locale: Locale) {
    return this.queries.listExercises(
      {
        category: input.category,
        difficulty: input.difficulty,
        sport: input.sport,
        availableEquipment: normalizeEquipment(input.equipment),
        search: normalizeSearch(input.q),
      },
      normalizePagination(input.page, input.pageSize),
      locale,
    );
  }

  async getExercise(slug: string, locale: Locale) {
    const e = await this.queries.getExercise(slug, locale);
    if (!e) throw new NotFoundError('Ejercicio no encontrado', 'EXERCISE_NOT_FOUND');
    return e;
  }

  async listWiki(input: { category: WikiCategory | null; q: string | null }, locale: Locale) {
    return this.queries.listWiki(
      { category: input.category, search: normalizeSearch(input.q) },
      locale,
    );
  }

  async getWikiArticle(slug: string, locale: Locale): Promise<WikiArticleDto> {
    const a = await this.queries.getWikiArticle(slug, locale);
    if (!a) throw new NotFoundError('Artículo no encontrado', 'ARTICLE_NOT_FOUND');
    const { relatedSlugs, ...article } = a;
    const related = relatedSlugs.length
      ? await this.queries.getWikiSummaries(relatedSlugs, locale)
      : [];
    // Mantener el orden editorial de `related`.
    related.sort((x, y) => relatedSlugs.indexOf(x.slug) - relatedSlugs.indexOf(y.slug));
    return {
      ...article,
      related,
      requiresHealthDisclaimer: requiresHealthDisclaimer(article.category),
    };
  }
}
