import { ActivityLevels, DietRestrictions, Levels, Sexes, TrainingGoals } from '@corner/shared';
import { z } from 'zod';
import type { Router } from '../../../../shared/infrastructure/http/router.js';
import type { Authenticator } from '../../../../shared/infrastructure/http/types.js';
import { parseBody } from '../../../../shared/infrastructure/http/validation.js';
import type {
  GetAthleteProfile,
  UpsertAthleteProfile,
} from '../../application/profile-use-cases.js';

const code = z.string().min(1).max(40);

export const ProfileSchema = z
  .object({
    sex: z.enum(Sexes),
    heightCm: z.number().int(),
    weightKg: z.number(),
    bodyFatPct: z.number().nullable().default(null),
    level: z.enum(Levels),
    goal: z.enum(TrainingGoals),
    activityLevel: z.enum(ActivityLevels),
    daysPerWeek: z.number().int(),
    sessionMinutes: z.number().int(),
    injuriesNotes: z.string().max(1000).nullable().default(null),
    sports: z.array(z.object({ code, level: z.enum(Levels) }).strict()).max(10),
    equipment: z.array(code).max(30).default([]),
    dietRestrictions: z.array(z.enum(DietRestrictions)).max(DietRestrictions.length).default([]),
  })
  .strict();

export function registerProfileRoutes(
  router: Router,
  d: { authenticate: Authenticator; get: GetAthleteProfile; upsert: UpsertAthleteProfile },
): void {
  router.get('/api/v1/me/profile', async (req) => {
    const userId = await d.authenticate(req);
    return {
      status: 200,
      body: await d.get.execute(userId),
      headers: { 'Cache-Control': 'no-store' },
    };
  });

  router.put('/api/v1/me/profile', async (req) => {
    const userId = await d.authenticate(req);
    const input = parseBody(ProfileSchema, req.body);
    return { status: 200, body: await d.upsert.execute(userId, input) };
  });
}
