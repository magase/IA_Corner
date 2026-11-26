import { z } from 'zod';
import { resolveLocale } from '../../../../shared/infrastructure/http/locale.js';
import type { Router } from '../../../../shared/infrastructure/http/router.js';
import type { Authenticator } from '../../../../shared/infrastructure/http/types.js';
import { parseBody } from '../../../../shared/infrastructure/http/validation.js';
import type {
  GetActiveNutritionPlan,
  GenerateNutritionPlan,
} from '../../../nutrition/application/nutrition-use-cases.js';
import type {
  GenerateTrainingPlan,
  GetActiveTrainingPlan,
} from '../../application/training-use-cases.js';

const TrainingBody = z
  .discriminatedUnion('mode', [
    z.object({ mode: z.literal('TEMPLATE') }).strict(),
    z.object({ mode: z.literal('AI'), request: z.string().trim().min(3).max(1000) }).strict(),
  ])
  .default({ mode: 'TEMPLATE' });

const NutritionBody = z
  .object({ kind: z.enum(['GENERAL', 'CALCULATED']).default('GENERAL') })
  .strict()
  .default({ kind: 'GENERAL' });

const noStore = { 'Cache-Control': 'no-store' };

export interface PlanRoutesDeps {
  authenticate: Authenticator;
  generateTraining: GenerateTrainingPlan;
  getTraining: GetActiveTrainingPlan;
  generateNutrition: GenerateNutritionPlan;
  getNutrition: GetActiveNutritionPlan;
}

export function registerPlanRoutes(router: Router, d: PlanRoutesDeps): void {
  router.post('/api/v1/me/plans/training', async (req) => {
    const userId = await d.authenticate(req);
    // Sin body = plan determinista (gratuito).
    const mode = parseBody(TrainingBody, req.body ?? { mode: 'TEMPLATE' });
    return {
      status: 201,
      body: await d.generateTraining.execute(userId, mode, resolveLocale(req)),
      headers: noStore,
    };
  });

  router.get('/api/v1/me/plans/training', async (req) => {
    const userId = await d.authenticate(req);
    return {
      status: 200,
      body: await d.getTraining.execute(userId, resolveLocale(req)),
      headers: noStore,
    };
  });

  router.post('/api/v1/me/plans/nutrition', async (req) => {
    const userId = await d.authenticate(req);
    const { kind } = parseBody(NutritionBody, req.body ?? { kind: 'GENERAL' });
    return {
      status: 201,
      body: await d.generateNutrition.execute(userId, kind, resolveLocale(req)),
      headers: noStore,
    };
  });

  router.get('/api/v1/me/plans/nutrition', async (req) => {
    const userId = await d.authenticate(req);
    return {
      status: 200,
      body: await d.getNutrition.execute(userId, resolveLocale(req)),
      headers: noStore,
    };
  });
}
