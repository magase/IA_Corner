import { Difficulties, Equipment, ExerciseCategories, WikiCategories } from '@corner/shared';
import { z } from 'zod';
import { resolveLocale } from '../../../../shared/infrastructure/http/locale.js';
import type { Router } from '../../../../shared/infrastructure/http/router.js';
import type { HttpRequest } from '../../../../shared/infrastructure/http/types.js';
import { parseBody } from '../../../../shared/infrastructure/http/validation.js';
import type { CatalogService } from '../../application/catalog-use-cases.js';

/** Contenido público y estable: cacheable por el navegador/CDN 5 minutos. */
const cache = { 'Cache-Control': 'public, max-age=300', Vary: 'Accept-Language' };

const csv = <T extends string>(values: readonly [T, ...T[]]) =>
  z
    .string()
    .max(300)
    .transform((s) =>
      s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.enum(values)).max(values.length));

const ExercisesQuery = z
  .object({
    category: z.enum(ExerciseCategories).optional(),
    difficulty: z.enum(Difficulties).optional(),
    sport: z
      .string()
      .regex(/^[A-Z_]{2,40}$/)
      .optional(),
    equipment: csv(Equipment).optional(),
    q: z.string().max(200).optional(),
    page: z.coerce.number().int().optional(),
    pageSize: z.coerce.number().int().optional(),
    lang: z.string().max(10).optional(),
  })
  .strict();

const WikiQuery = z
  .object({
    category: z.enum(WikiCategories).optional(),
    q: z.string().max(200).optional(),
    lang: z.string().max(10).optional(),
  })
  .strict();

const slugParam = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(80);
const query = (req: HttpRequest) => Object.fromEntries(req.query.entries());

export function registerCatalogRoutes(router: Router, catalog: CatalogService): void {
  router.get('/api/v1/sports', async (req) => ({
    status: 200,
    body: await catalog.listSports(resolveLocale(req)),
    headers: cache,
  }));

  router.get('/api/v1/equipment', async (req) => ({
    status: 200,
    body: await catalog.listEquipment(resolveLocale(req)),
    headers: cache,
  }));

  router.get('/api/v1/exercises', async (req) => {
    const q = parseBody(ExercisesQuery, query(req));
    const page = await catalog.listExercises(
      {
        category: q.category ?? null,
        difficulty: q.difficulty ?? null,
        sport: q.sport ?? null,
        equipment: q.equipment ?? null,
        q: q.q ?? null,
        page: q.page ?? null,
        pageSize: q.pageSize ?? null,
      },
      resolveLocale(req),
    );
    return { status: 200, body: page, headers: cache };
  });

  router.get('/api/v1/exercises/:slug', async (req) => {
    const slug = parseBody(slugParam, req.params['slug']);
    return {
      status: 200,
      body: await catalog.getExercise(slug, resolveLocale(req)),
      headers: cache,
    };
  });

  router.get('/api/v1/wiki', async (req) => {
    const q = parseBody(WikiQuery, query(req));
    const items = await catalog.listWiki(
      { category: q.category ?? null, q: q.q ?? null },
      resolveLocale(req),
    );
    return { status: 200, body: items, headers: cache };
  });

  router.get('/api/v1/wiki/:slug', async (req) => {
    const slug = parseBody(slugParam, req.params['slug']);
    return {
      status: 200,
      body: await catalog.getWikiArticle(slug, resolveLocale(req)),
      headers: cache,
    };
  });
}
