import {
  Equipment,
  resolveFeatures,
  type EquipmentType,
  type Locale,
  type TrainingPlanDto,
} from '@corner/shared';
import {
  requireAthlete,
  requireHealthConsent,
  type AthleteContextReader,
} from '../../../shared/application/athlete-context.js';
import type { EntitlementsReader } from '../../../shared/application/entitlements.js';
import type { Clock } from '../../../shared/application/ports.js';
import {
  NotFoundError,
  PremiumRequiredError,
  ValidationError,
} from '../../../shared/domain/errors.js';
import { generateTrainingPlan, type GeneratorInput } from '../domain/plan-generator.js';
import type { ExerciseCandidateReader, PlanPersonalizer, TrainingPlanRepository } from './ports.js';

export type PlanMode = { mode: 'TEMPLATE' } | { mode: 'AI'; request: string };

export class GenerateTrainingPlan {
  constructor(
    private readonly athletes: AthleteContextReader,
    private readonly candidates: ExerciseCandidateReader,
    private readonly plans: TrainingPlanRepository,
    private readonly entitlements: EntitlementsReader,
    private readonly clock: Clock,
    private readonly personalizer: PlanPersonalizer | null = null,
  ) {}

  async execute(userId: string, mode: PlanMode, locale: Locale): Promise<TrainingPlanDto> {
    const { profile } = await requireAthlete(this.athletes, userId);
    const plan = await this.entitlements.forUser(userId);
    const features = resolveFeatures(plan.tier, plan.addOns);

    if (mode.mode === 'AI' && !features.has('AI_PERSONALIZED_PLAN')) {
      throw new PremiumRequiredError(
        'El plan personalizado con IA es una función premium',
        'AI_PERSONALIZED_PLAN',
      );
    }
    if (!features.has('DETERMINISTIC_PLAN')) {
      throw new PremiumRequiredError(
        'Tu plan no incluye generación de planes',
        'DETERMINISTIC_PLAN',
      );
    }

    const catalog = await this.candidates.listCandidates();
    const equipment = profile.equipment.filter((e): e is EquipmentType =>
      (Equipment as readonly string[]).includes(e),
    );
    const input: GeneratorInput = {
      goal: profile.goal,
      level: profile.level,
      daysPerWeek: profile.daysPerWeek,
      sessionMinutes: profile.sessionMinutes,
      sports: profile.sports.map((s) => s.code),
      equipment: equipment.length ? equipment : ['NONE'],
    };
    let draft = generateTrainingPlan(input, catalog);
    let rationale: string | null = null;

    if (mode.mode === 'AI') {
      if (!this.personalizer) {
        throw new ValidationError(
          'La personalización con IA aún no está disponible',
          'AI_PLAN_UNAVAILABLE',
        );
      }
      const r = await this.personalizer.personalize({
        profile,
        request: mode.request,
        draft,
        catalog,
      });
      draft = r.plan;
      rationale = r.rationale;
    }
    if (draft.sessions.length === 0) {
      throw new ValidationError(
        'No hay ejercicios disponibles para tu perfil todavía',
        'EMPTY_CATALOG',
      );
    }

    const today = this.clock.now();
    await this.plans.replaceActive(userId, {
      ...draft,
      source: mode.mode,
      startsOn: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())),
      params: { ...input },
      aiRationale: rationale,
    });
    const saved = await this.plans.findActive(userId, locale);
    if (!saved) throw new NotFoundError('Plan no encontrado', 'PLAN_NOT_FOUND');
    return saved;
  }
}

export class GetActiveTrainingPlan {
  constructor(
    private readonly plans: TrainingPlanRepository,
    private readonly athletes: AthleteContextReader,
  ) {}

  async execute(userId: string, locale: Locale): Promise<TrainingPlanDto> {
    await requireHealthConsent(this.athletes, userId);
    const plan = await this.plans.findActive(userId, locale);
    if (!plan) throw new NotFoundError('Aún no tienes un plan de entrenamiento', 'PLAN_NOT_FOUND');
    return plan;
  }
}
