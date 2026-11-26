import type { AthleteProfileDto, Locale, TrainingPlanDto } from '@corner/shared';
import type { ExerciseCandidate, PlanDraft } from '../domain/plan-generator.js';

export interface ExerciseCandidateReader {
  /** Ejercicios activos (drills solo de deportes activos). */
  listCandidates(): Promise<ExerciseCandidate[]>;
}

export interface TrainingPlanRepository {
  /** Archiva el plan activo anterior y guarda el nuevo como activo. Devuelve su id. */
  replaceActive(
    userId: string,
    plan: PlanDraft & {
      source: 'TEMPLATE' | 'AI';
      startsOn: Date;
      params: Record<string, unknown>;
      aiRationale: string | null;
    },
  ): Promise<string>;
  findActive(userId: string, locale: Locale): Promise<TrainingPlanDto | null>;
}

/** Premium (fuera del MVP): personalización con IA a partir del borrador determinista. */
export interface PlanPersonalizer {
  personalize(input: {
    profile: AthleteProfileDto;
    request: string;
    draft: PlanDraft;
    catalog: ExerciseCandidate[];
  }): Promise<{ plan: PlanDraft; rationale: string }>;
}
