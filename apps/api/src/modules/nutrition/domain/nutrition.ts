import type { ActivityLevel, NutritionGuidelineDto, Sex, TrainingGoal } from '@corner/shared';

/** Factores de actividad habituales (FAO/OMS, uso general). */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  HIGH: 1.725,
  VERY_HIGH: 1.9,
};

/** Ecuación de Mifflin-St Jeor (kcal/día). */
export function mifflinStJeor(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return base + (sex === 'MALE' ? 5 : -161);
}

/** Ajuste calórico moderado por objetivo. Sin déficits agresivos: el foco es entrenar y rendir. */
const GOAL_ADJUSTMENT: Record<TrainingGoal, number> = {
  GENERAL_FITNESS: 0,
  STRENGTH_POWER: 0.05,
  CONDITIONING: 0,
  TECHNIQUE: 0,
  BODY_COMPOSITION: -0.1,
};

/** Proteína en g/kg dentro del rango 1,6–2,2 g/kg (ISSN). */
const PROTEIN_G_PER_KG: Record<TrainingGoal, number> = {
  GENERAL_FITNESS: 1.6,
  STRENGTH_POWER: 2.0,
  CONDITIONING: 1.8,
  TECHNIQUE: 1.6,
  BODY_COMPOSITION: 2.0,
};

const FAT_SHARE = 0.27;
const MIN_FAT_G_PER_KG = 0.8;

export interface MacroInput {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
  activityLevel: ActivityLevel;
  goal: TrainingGoal;
  daysPerWeek: number;
  sessionMinutes: number;
}

/** Nivel de actividad mínimo según el volumen de entrenamiento declarado (min/semana). */
export function activityFromTraining(daysPerWeek: number, sessionMinutes: number): ActivityLevel {
  const weekly = daysPerWeek * sessionMinutes;
  if (weekly >= 450) return 'VERY_HIGH';
  if (weekly >= 300) return 'HIGH';
  if (weekly >= 150) return 'MODERATE';
  if (weekly > 0) return 'LIGHT';
  return 'SEDENTARY';
}

/** Alto volumen: misma condición que la recomendación CARBS_HIGH_VOLUME. */
export function isHighVolume(goal: TrainingGoal, daysPerWeek: number): boolean {
  return daysPerWeek >= 5 || goal === 'CONDITIONING';
}

/** Suelo de energía para evitar baja disponibilidad energética (orientativo). */
const KCAL_FLOOR: Record<Sex, number> = { FEMALE: 1500, MALE: 1800 };
const BMR_FLOOR_FACTOR = 1.3;

export interface MacroTargets {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** Premium: objetivo de calorías y macros (punto de partida orientativo). */
export function calculateTargets(i: MacroInput): MacroTargets {
  const bmr = mifflinStJeor(i.sex, i.weightKg, i.heightCm, i.age);
  // Se usa el mayor entre la actividad declarada y la que implica el entrenamiento.
  const factor = Math.max(
    ACTIVITY_FACTORS[i.activityLevel],
    ACTIVITY_FACTORS[activityFromTraining(i.daysPerWeek, i.sessionMinutes)],
  );
  let kcal = bmr * factor * (1 + GOAL_ADJUSTMENT[i.goal]);
  kcal = Math.max(kcal, bmr * BMR_FLOOR_FACTOR, KCAL_FLOOR[i.sex]);

  const proteinG = Math.round(PROTEIN_G_PER_KG[i.goal] * i.weightKg);
  const minCarbsG = (isHighVolume(i.goal, i.daysPerWeek) ? 5 : 3) * i.weightKg;
  const minFatG = MIN_FAT_G_PER_KG * i.weightKg;
  let fatG = Math.max((kcal * FAT_SHARE) / 9, minFatG);
  let carbsG = (kcal - proteinG * 4 - fatG * 9) / 4;
  if (carbsG < minCarbsG) {
    // Primero se reduce la grasa hasta su suelo; si no basta, se priorizan los carbohidratos
    // necesarios para entrenar antes que el déficit.
    fatG = Math.max(minFatG, (kcal - proteinG * 4 - minCarbsG * 4) / 9);
    carbsG = (kcal - proteinG * 4 - fatG * 9) / 4;
    if (carbsG < minCarbsG) {
      carbsG = minCarbsG;
      kcal = proteinG * 4 + carbsG * 4 + fatG * 9;
    }
  }
  return {
    kcal: Math.round(kcal / 10) * 10,
    proteinG,
    carbsG: Math.round(carbsG),
    fatG: Math.round(fatG),
  };
}

/** Gratis: recomendaciones generales, sin calcular calorías. El front traduce `code`. */
export function generalGuidelines(
  goal: TrainingGoal,
  sessionsPerWeek: number,
): NutritionGuidelineDto[] {
  const g: NutritionGuidelineDto[] = [
    { code: 'PROTEIN_RANGE', params: { min: 1.6, max: 2.2, unit: 'g/kg' } },
    { code: 'PROTEIN_DISTRIBUTION', params: { meals: '3-5', perMealGPerKg: 0.3 } },
    { code: 'PLATE_METHOD', params: {} },
    { code: 'VEGETABLES_FRUIT', params: { servingsPerDay: 5 } },
    { code: 'HYDRATION_DAILY', params: {} },
    { code: 'PRE_WORKOUT_MEAL', params: { hoursBefore: '2-3' } },
    { code: 'POST_WORKOUT_MEAL', params: { hoursAfter: 2 } },
    { code: 'SLEEP', params: { hours: '7-9' } },
  ];
  if (sessionsPerWeek >= 5 || goal === 'CONDITIONING') {
    g.push({ code: 'CARBS_HIGH_VOLUME', params: { min: 5, max: 7, unit: 'g/kg' } });
  }
  if (goal === 'BODY_COMPOSITION')
    g.push({ code: 'MODERATE_DEFICIT_ONLY', params: { maxPct: 10 } });
  if (goal === 'STRENGTH_POWER') g.push({ code: 'SLIGHT_SURPLUS', params: { pct: 5 } });
  return g;
}

export interface SupplementSuggestion {
  slug: string;
  reason: string; // código traducible
}

/** Sugerencias conservadoras, con evidencia sólida y enlazadas a la wiki. */
export function suggestSupplements(
  goal: TrainingGoal,
  sessionsPerWeek: number,
): SupplementSuggestion[] {
  const s: SupplementSuggestion[] = [];
  if (goal === 'STRENGTH_POWER' || goal === 'BODY_COMPOSITION' || sessionsPerWeek >= 4) {
    s.push({ slug: 'creatina-monohidrato', reason: 'STRENGTH_AND_REPEATED_EFFORTS' });
  }
  s.push({ slug: 'proteina-whey', reason: 'ONLY_IF_DIET_IS_SHORT_ON_PROTEIN' });
  if (goal === 'CONDITIONING' || sessionsPerWeek >= 5) {
    s.push({ slug: 'cafeina', reason: 'OPTIONAL_PERFORMANCE_CHECK_TOLERANCE' });
    s.push({ slug: 'bebidas-deportivas-electrolitos', reason: 'LONG_OR_HOT_SESSIONS' });
  }
  s.push({ slug: 'vitamina-d3-suplemento', reason: 'ONLY_IF_LOW_LEVELS_CONFIRMED' });
  return s;
}

export function ageFrom(birthDate: Date, today: Date): number {
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const m = today.getUTCMonth() - birthDate.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < birthDate.getUTCDate())) age--;
  return age;
}
