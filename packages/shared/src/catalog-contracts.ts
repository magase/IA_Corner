import type {
  Difficulty,
  EquipmentType,
  EvidenceLevel,
  ExerciseCategory,
  Locale,
  MeasureType,
  Muscle,
  SportCategory,
  WadaStatus,
  WikiCategory,
} from './enums.js';

export interface SportDto {
  code: string;
  category: SportCategory;
  name: string;
  description: string;
}

export interface EquipmentDto {
  code: EquipmentType;
  name: string;
}

export interface ExerciseSummaryDto {
  slug: string;
  name: string;
  category: ExerciseCategory;
  difficulty: Difficulty;
  measureType: MeasureType;
  primaryMuscles: Muscle[];
  equipment: EquipmentType[];
  sports: string[];
  thumbnailUrl: string | null;
}

export interface ExerciseDetailDto extends ExerciseSummaryDto {
  description: string;
  steps: string[];
  commonMistakes: string[];
  tips: string[];
  secondaryMuscles: Muscle[];
  defaults: {
    sets: number | null;
    reps: string | null;
    seconds: number | null;
    restSec: number | null;
  };
  media: { url: string; type: 'video' | 'gif' | 'image' } | null;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface WikiSummaryDto {
  slug: string;
  category: WikiCategory;
  title: string;
  summary: string;
}

export interface SupplementFactsDto {
  evidenceLevel: EvidenceLevel;
  wadaStatus: WadaStatus;
  whatItIs: string;
  purpose: string;
  dosage: string;
  timing: string;
  sideEffects: string;
}

export interface WikiArticleDto extends WikiSummaryDto {
  locale: Locale;
  body: string;
  sources: { title: string; url: string }[];
  related: WikiSummaryDto[];
  supplement: SupplementFactsDto | null;
  /** El front debe mostrar el aviso "consulta a un profesional sanitario o nutricionista". */
  requiresHealthDisclaimer: boolean;
  updatedAt: string;
}
