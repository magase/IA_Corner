import type { Feature } from './entitlements.js';
import type {
  ActivityLevel,
  AddOn,
  DietRestriction,
  Level,
  Locale,
  Sex,
  SubscriptionTier,
  TrainingGoal,
} from './enums.js';

/** Contratos HTTP compartidos entre API y app. */
export interface PublicUserDto {
  id: string;
  email: string;
  displayName: string;
  locale: Locale;
  birthDate: string; // YYYY-MM-DD
  hasHealthConsent: boolean;
  createdAt: string; // ISO
}

export interface AuthSessionResponse {
  accessToken: string;
  expiresIn: number; // segundos
  user: PublicUserDto;
}

export interface MeResponse {
  user: PublicUserDto;
  plan: {
    tier: SubscriptionTier;
    addOns: AddOn[];
    features: Feature[];
    limits: { workoutLogRows: number | null };
  };
}

export interface AthleteProfileDto {
  sex: Sex;
  heightCm: number;
  weightKg: number;
  bodyFatPct: number | null;
  level: Level;
  goal: TrainingGoal;
  activityLevel: ActivityLevel;
  daysPerWeek: number;
  sessionMinutes: number;
  injuriesNotes: string | null;
  sports: { code: string; level: Level }[];
  equipment: string[];
  dietRestrictions: DietRestriction[];
}

export interface ApiErrorBody {
  error: string;
  reason?: string;
  message?: string;
  details?: unknown;
}

/** Cabecera anti-CSRF obligatoria en /auth/refresh y /auth/logout. */
export const CLIENT_HEADER = 'X-Corner-Client';
