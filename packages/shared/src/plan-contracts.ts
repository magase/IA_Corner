import type {
  Difficulty,
  EquipmentType,
  ExerciseCategory,
  MeasureType,
  Muscle,
  TrainingGoal,
} from './enums.js';

export const SessionFocuses = [
  'STRENGTH_FULL',
  'STRENGTH_LOWER',
  'STRENGTH_UPPER',
  'POWER',
  'SPORT_TECHNIQUE',
  'SPORT_CONDITIONING',
  'MOBILITY_RECOVERY',
] as const;
export type SessionFocus = (typeof SessionFocuses)[number];

export const SessionBlocks = ['WARMUP', 'MAIN', 'FINISHER', 'COOLDOWN'] as const;
export type SessionBlock = (typeof SessionBlocks)[number];

export interface PlanExerciseDto {
  slug: string;
  name: string;
  category: ExerciseCategory;
  measureType: MeasureType;
  block: SessionBlock;
  sets: number | null;
  reps: string | null;
  seconds: number | null;
  rounds: number | null;
  restSec: number | null;
}

export interface PlanSessionDto {
  id: string;
  dayOfWeek: number; // 1 = lunes … 7 = domingo
  focus: SessionFocus;
  exercises: PlanExerciseDto[];
}

export interface TrainingPlanDto {
  id: string;
  source: 'TEMPLATE' | 'AI';
  name: string; // código traducible, p. ej. CONDITIONING_4D
  goal: TrainingGoal;
  startsOn: string;
  createdAt: string;
  sessions: PlanSessionDto[];
}

/** Recomendación estructurada: el front la traduce con `code` y rellena `params`. */
export interface NutritionGuidelineDto {
  code: string;
  params: Record<string, number | string>;
}

export interface NutritionPlanDto {
  id: string;
  kind: 'GENERAL' | 'CALCULATED';
  goal: TrainingGoal;
  targets: { kcal: number; proteinG: number; carbsG: number; fatG: number } | null;
  guidelines: NutritionGuidelineDto[];
  menu: { title: string; content: Record<string, string[]> } | null;
  supplements: { slug: string; title: string; reason: string }[];
  requiresHealthDisclaimer: true;
  createdAt: string;
}

export interface WorkoutEntryDto {
  exerciseSlug: string;
  exerciseName: string;
  setIndex: number;
  reps: number | null;
  weightKg: number | null;
  seconds: number | null;
  rounds: number | null;
  rpe: number | null;
}

export interface WorkoutLogDto {
  id: string;
  performedAt: string;
  sessionId: string | null;
  durationMin: number | null;
  rpe: number | null;
  feeling: number | null;
  notes: string | null;
  entries: WorkoutEntryDto[];
}

export interface WorkoutHistoryDto {
  items: Omit<WorkoutLogDto, 'entries'>[];
  total: number;
  /** null = ilimitado (premium). */
  limit: number | null;
}

export type { Difficulty, EquipmentType, Muscle };
