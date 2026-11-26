import type {
  EquipmentDto,
  ExerciseDetailDto,
  ExerciseSummaryDto,
  Locale,
  Page,
  SportDto,
  WikiArticleDto,
  WikiSummaryDto,
} from '@corner/shared';
import type { ExerciseFilter, Pagination, WikiFilter } from '../domain/catalog-filters.js';

/** Lectura del catálogo, ya traducido al idioma pedido (con fallback al español). */
export interface CatalogQueries {
  listSports(locale: Locale): Promise<SportDto[]>;
  listEquipment(locale: Locale): Promise<EquipmentDto[]>;
  listExercises(
    filter: ExerciseFilter,
    page: Pagination,
    locale: Locale,
  ): Promise<Page<ExerciseSummaryDto>>;
  getExercise(slug: string, locale: Locale): Promise<ExerciseDetailDto | null>;
  listWiki(filter: WikiFilter, locale: Locale): Promise<WikiSummaryDto[]>;
  /** Sin `related` ni `requiresHealthDisclaimer`: los compone el caso de uso. */
  getWikiArticle(
    slug: string,
    locale: Locale,
  ): Promise<
    | (Omit<WikiArticleDto, 'related' | 'requiresHealthDisclaimer'> & { relatedSlugs: string[] })
    | null
  >;
  getWikiSummaries(slugs: string[], locale: Locale): Promise<WikiSummaryDto[]>;
}
