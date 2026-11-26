import {
  resolveFeatures,
  type Locale,
  type NutritionGuidelineDto,
  type NutritionPlanDto,
  type TrainingGoal,
} from '@corner/shared';
import {
  requireAthlete,
  requireHealthConsent,
  type AthleteContextReader,
} from '../../../shared/application/athlete-context.js';
import type { EntitlementsReader } from '../../../shared/application/entitlements.js';
import type { Clock } from '../../../shared/application/ports.js';
import { NotFoundError, PremiumRequiredError } from '../../../shared/domain/errors.js';
import {
  ageFrom,
  calculateTargets,
  generalGuidelines,
  suggestSupplements,
  type MacroTargets,
  type SupplementSuggestion,
} from '../domain/nutrition.js';

export interface NutritionPlanDraft {
  kind: 'GENERAL' | 'CALCULATED';
  goal: TrainingGoal;
  targets: MacroTargets | null;
  guidelines: NutritionGuidelineDto[];
  supplements: SupplementSuggestion[];
}

export interface NutritionPlanRepository {
  /** Archiva el plan activo y guarda el nuevo; enlaza el menú genérico del objetivo y los suplementos existentes. */
  replaceActive(userId: string, draft: NutritionPlanDraft): Promise<string>;
  findActive(userId: string, locale: Locale): Promise<NutritionPlanDto | null>;
}

export class GenerateNutritionPlan {
  constructor(
    private readonly athletes: AthleteContextReader,
    private readonly plans: NutritionPlanRepository,
    private readonly entitlements: EntitlementsReader,
    private readonly clock: Clock,
  ) {}

  async execute(
    userId: string,
    kind: 'GENERAL' | 'CALCULATED',
    locale: Locale,
  ): Promise<NutritionPlanDto> {
    const { profile, birthDate } = await requireAthlete(this.athletes, userId);
    if (kind === 'CALCULATED') {
      const plan = await this.entitlements.forUser(userId);
      if (!resolveFeatures(plan.tier, plan.addOns).has('MACRO_CALCULATOR')) {
        throw new PremiumRequiredError(
          'El cálculo de calorías y macros es una función premium',
          'MACRO_CALCULATOR',
        );
      }
    }
    const targets =
      kind === 'CALCULATED'
        ? calculateTargets({
            sex: profile.sex,
            weightKg: profile.weightKg,
            heightCm: profile.heightCm,
            age: ageFrom(birthDate, this.clock.now()),
            activityLevel: profile.activityLevel,
            goal: profile.goal,
            daysPerWeek: profile.daysPerWeek,
            sessionMinutes: profile.sessionMinutes,
          })
        : null;
    await this.plans.replaceActive(userId, {
      kind,
      goal: profile.goal,
      targets,
      guidelines: generalGuidelines(profile.goal, profile.daysPerWeek),
      supplements: suggestSupplements(profile.goal, profile.daysPerWeek),
    });
    const saved = await this.plans.findActive(userId, locale);
    if (!saved) throw new NotFoundError('Plan no encontrado', 'NUTRITION_PLAN_NOT_FOUND');
    return saved;
  }
}

export class GetActiveNutritionPlan {
  constructor(
    private readonly plans: NutritionPlanRepository,
    private readonly athletes: AthleteContextReader,
    private readonly entitlements: EntitlementsReader,
  ) {}

  async execute(userId: string, locale: Locale): Promise<NutritionPlanDto> {
    await requireHealthConsent(this.athletes, userId);
    const p = await this.plans.findActive(userId, locale);
    if (!p)
      throw new NotFoundError('Aún no tienes un plan nutricional', 'NUTRITION_PLAN_NOT_FOUND');
    // Si ya no es premium, no se siguen mostrando calorías y macros calculados.
    const plan = await this.entitlements.forUser(userId);
    if (p.targets && !resolveFeatures(plan.tier, plan.addOns).has('MACRO_CALCULATOR')) {
      return { ...p, targets: null };
    }
    return p;
  }
}
