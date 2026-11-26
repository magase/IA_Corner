import { z } from 'zod';
import { resolveLocale } from '../../../../shared/infrastructure/http/locale.js';
import type { Router } from '../../../../shared/infrastructure/http/router.js';
import type { Authenticator, HttpRequest } from '../../../../shared/infrastructure/http/types.js';
import { parseBody } from '../../../../shared/infrastructure/http/validation.js';
import type { WorkoutService } from '../../application/workout-use-cases.js';
import { MAX_ENTRIES } from '../../domain/workout.js';

const num = z.number().nullable().default(null);
const int = z.number().int().nullable().default(null);

const EntrySchema = z
  .object({
    exerciseSlug: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      .max(80),
    setIndex: z.number().int(),
    reps: int,
    weightKg: num,
    seconds: int,
    rounds: int,
    rpe: int,
  })
  .strict();

const WorkoutSchema = z
  .object({
    performedAt: z.iso.datetime({ offset: true }).transform((s) => new Date(s)),
    sessionId: z.uuid().nullable().default(null),
    durationMin: int,
    rpe: int,
    feeling: int,
    notes: z.string().max(1000).nullable().default(null),
    entries: z.array(EntrySchema).max(MAX_ENTRIES).default([]),
  })
  .strict();

const PageQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
    lang: z.string().max(10).optional(),
  })
  .strict();

const idParam = (req: HttpRequest) => parseBody(z.uuid(), req.params['id']);
const noStore = { 'Cache-Control': 'no-store' };

export function registerWorkoutRoutes(
  router: Router,
  d: { authenticate: Authenticator; workouts: WorkoutService },
): void {
  router.post('/api/v1/me/workouts', async (req) => {
    const userId = await d.authenticate(req);
    const input = parseBody(WorkoutSchema, req.body);
    return {
      status: 201,
      body: await d.workouts.log(userId, input, resolveLocale(req)),
      headers: noStore,
    };
  });

  router.get('/api/v1/me/workouts', async (req) => {
    const userId = await d.authenticate(req);
    const q = parseBody(PageQuery, Object.fromEntries(req.query.entries()));
    return {
      status: 200,
      body: await d.workouts.history(userId, q.page, q.pageSize),
      headers: noStore,
    };
  });

  router.get('/api/v1/me/workouts/:id', async (req) => {
    const userId = await d.authenticate(req);
    return {
      status: 200,
      body: await d.workouts.get(userId, idParam(req), resolveLocale(req)),
      headers: noStore,
    };
  });

  router.delete('/api/v1/me/workouts/:id', async (req) => {
    const userId = await d.authenticate(req);
    await d.workouts.delete(userId, idParam(req));
    return { status: 204 };
  });

  /** "Borrar todo": libera el límite del plan gratuito. */
  router.delete('/api/v1/me/workouts', async (req) => {
    const userId = await d.authenticate(req);
    return { status: 200, body: await d.workouts.deleteAll(userId) };
  });
}
