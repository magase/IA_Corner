import { beforeEach, describe, expect, it } from 'vitest';
import { article, exercise, InMemoryCatalogQueries } from '../../../../test/fakes/catalog.js';
import { CatalogService } from './catalog-use-cases.js';

const none = {
  category: null,
  difficulty: null,
  sport: null,
  equipment: null,
  q: null,
  page: null,
  pageSize: null,
};
let q: InMemoryCatalogQueries;
let svc: CatalogService;

beforeEach(() => {
  q = new InMemoryCatalogQueries();
  svc = new CatalogService(q);
  q.exercises = [
    exercise({ slug: 'goblet-squat', name: 'Sentadilla goblet', equipment: ['DUMBBELLS'] }),
    exercise({ slug: 'push-up', name: 'Flexiones' }),
    exercise({ slug: 'barbell-row', name: 'Remo con barra', equipment: ['BARBELL'] }),
    exercise({
      slug: 'boxing-shadow',
      category: 'SPORT_DRILL',
      sports: ['BOXING'],
      measureType: 'ROUNDS',
    }),
  ];
});

describe('CatalogService.listExercises', () => {
  it('filters by available equipment, always including bodyweight', async () => {
    const r = await svc.listExercises({ ...none, equipment: ['DUMBBELLS'] }, 'es');
    expect(r.items.map((e) => e.slug)).toEqual(['goblet-squat', 'push-up', 'boxing-shadow']);
  });

  it('FULL_GYM disables the equipment filter', async () => {
    const r = await svc.listExercises({ ...none, equipment: ['FULL_GYM'] }, 'es');
    expect(r.total).toBe(4);
  });

  it('paginates with defaults and validates page size', async () => {
    const r = await svc.listExercises({ ...none, pageSize: 2, page: 2 }, 'en');
    expect(r).toMatchObject({ page: 2, pageSize: 2, total: 4 });
    expect(r.items).toHaveLength(2);
    expect(q.lastLocale).toBe('en');
    await expect(svc.listExercises({ ...none, pageSize: 500 }, 'es')).rejects.toMatchObject({
      reason: 'INVALID_PAGE_SIZE',
    });
  });

  it('searches by normalized text and filters by sport', async () => {
    expect((await svc.listExercises({ ...none, q: '  sentadilla ' }, 'es')).items).toHaveLength(1);
    expect((await svc.listExercises({ ...none, sport: 'BOXING' }, 'es')).items[0]?.slug).toBe(
      'boxing-shadow',
    );
  });

  it('getExercise returns NOT_FOUND for unknown slugs', async () => {
    await expect(svc.getExercise('nope', 'es')).rejects.toMatchObject({
      reason: 'EXERCISE_NOT_FOUND',
    });
    await expect(svc.getExercise('push-up', 'es')).resolves.toMatchObject({ name: 'Flexiones' });
  });
});

describe('CatalogService.getWikiArticle', () => {
  beforeEach(() => {
    q.articles = [
      article({
        slug: 'creatina-monohidrato',
        category: 'SUPPLEMENT',
        relatedSlugs: ['sobrecarga-progresiva', 'proteinas', 'missing'],
        supplement: {
          evidenceLevel: 'STRONG',
          wadaStatus: 'PERMITTED',
          whatItIs: 'x',
          purpose: 'y',
          dosage: '3-5 g/día',
          timing: 'cualquiera',
          sideEffects: 'z',
        },
      }),
      article({ slug: 'proteinas', category: 'MACRONUTRIENT' }),
      article({ slug: 'sobrecarga-progresiva' }),
    ];
  });

  it('composes related summaries in editorial order and skips missing ones', async () => {
    const a = await svc.getWikiArticle('creatina-monohidrato', 'es');
    expect(a.related.map((r) => r.slug)).toEqual(['sobrecarga-progresiva', 'proteinas']);
    expect(a).not.toHaveProperty('relatedSlugs');
  });

  it('flags health disclaimer for nutrition/supplements but not training concepts', async () => {
    expect((await svc.getWikiArticle('creatina-monohidrato', 'es')).requiresHealthDisclaimer).toBe(
      true,
    );
    expect((await svc.getWikiArticle('sobrecarga-progresiva', 'es')).requiresHealthDisclaimer).toBe(
      false,
    );
  });

  it('returns NOT_FOUND for unknown articles', async () => {
    await expect(svc.getWikiArticle('nope', 'es')).rejects.toMatchObject({
      reason: 'ARTICLE_NOT_FOUND',
    });
  });
});
