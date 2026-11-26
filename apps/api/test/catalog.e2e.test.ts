import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { article, exercise } from './fakes/catalog.js';
import { startTestApp } from './helpers/build-test-app.js';

describe('Catálogo y wiki (e2e)', () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;
  const get = (path: string, headers: Record<string, string> = {}) =>
    fetch(`${app.base}${path}`, { headers });

  beforeAll(async () => {
    app = await startTestApp();
    app.catalogQueries.exercises = [
      exercise({ slug: 'goblet-squat', equipment: ['DUMBBELLS'] }),
      exercise({ slug: 'push-up' }),
    ];
    app.catalogQueries.articles = [article({ slug: 'cafeina', category: 'SUPPLEMENT' })];
  });
  afterAll(() => app.close());

  it('is public, cacheable and varies by language', async () => {
    const res = await get('/api/v1/sports');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=300');
    expect(res.headers.get('vary')).toContain('Accept-Language');
  });

  it('keeps CORS Vary: Origin alongside Accept-Language', async () => {
    const res = await get('/api/v1/sports', { Origin: 'http://localhost:4200' });
    const vary = (res.headers.get('vary') ?? '').split(',').map((v) => v.trim());
    expect(vary).toEqual(expect.arrayContaining(['Origin', 'Accept-Language']));
  });

  it('resolves locale from ?lang and Accept-Language', async () => {
    await get('/api/v1/equipment?lang=en');
    expect(app.catalogQueries.lastLocale).toBe('en');
    await get('/api/v1/equipment', { 'Accept-Language': 'es-ES,es;q=0.9' });
    expect(app.catalogQueries.lastLocale).toBe('es');
  });

  it('lists exercises with equipment csv filter and pagination', async () => {
    const res = await get('/api/v1/exercises?equipment=NONE&pageSize=10');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ total: 1, page: 1, pageSize: 10 });
    expect(body.items[0].slug).toBe('push-up');
  });

  it('rejects unknown filters and invalid values', async () => {
    expect((await get('/api/v1/exercises?equipment=LASER')).status).toBe(400);
    expect((await get('/api/v1/exercises?hack=1')).status).toBe(400);
    expect((await get('/api/v1/exercises?pageSize=999')).status).toBe(400);
    expect((await get('/api/v1/exercises/Bad_Slug')).status).toBe(400);
  });

  it('returns exercise detail and 404 for unknown', async () => {
    expect((await (await get('/api/v1/exercises/push-up')).json()).steps).toHaveLength(3);
    const nf = await get('/api/v1/exercises/no-existe');
    expect(nf.status).toBe(404);
    expect((await nf.json()).reason).toBe('EXERCISE_NOT_FOUND');
  });

  it('serves wiki list and article with disclaimer flag', async () => {
    expect(await (await get('/api/v1/wiki?category=SUPPLEMENT')).json()).toHaveLength(1);
    const a = await (await get('/api/v1/wiki/cafeina')).json();
    expect(a).toMatchObject({ slug: 'cafeina', requiresHealthDisclaimer: true, related: [] });
  });
});
