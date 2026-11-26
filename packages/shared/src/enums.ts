export const Locales = ['es', 'en'] as const;
export type Locale = (typeof Locales)[number];
export const DEFAULT_LOCALE: Locale = 'es';

export const SubscriptionTiers = ['FREE', 'PREMIUM'] as const;
export type SubscriptionTier = (typeof SubscriptionTiers)[number];

export const AddOns = ['RECIPES', 'FOOD_LOG'] as const;
export type AddOn = (typeof AddOns)[number];

export const SportCategories = ['STRIKING', 'GRAPPLING'] as const;
export type SportCategory = (typeof SportCategories)[number];

/** Deportes activos en la app. Los de grappling solo existen en BD. */
export const StrikingSports = ['MUAY_THAI', 'BOXING', 'KICKBOXING', 'TAEKWONDO', 'KARATE'] as const;
export type StrikingSport = (typeof StrikingSports)[number];

export const ExerciseCategories = [
  'STRENGTH',
  'PLYOMETRICS',
  'MOBILITY',
  'FLEXIBILITY',
  'SPORT_DRILL',
] as const;
export type ExerciseCategory = (typeof ExerciseCategories)[number];

export const Levels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'COMPETITOR'] as const;
export type Level = (typeof Levels)[number];

export const TrainingGoals = [
  'GENERAL_FITNESS',
  'STRENGTH_POWER',
  'CONDITIONING',
  'TECHNIQUE',
  'BODY_COMPOSITION',
] as const;
export type TrainingGoal = (typeof TrainingGoals)[number];

export const Equipment = [
  'NONE',
  'DUMBBELLS',
  'KETTLEBELL',
  'BARBELL',
  'RESISTANCE_BAND',
  'PULL_UP_BAR',
  'HEAVY_BAG',
  'JUMP_ROPE',
  'BOX',
  'MEDICINE_BALL',
  'FULL_GYM',
] as const;
export type EquipmentType = (typeof Equipment)[number];

export const Sexes = ['MALE', 'FEMALE'] as const;
export type Sex = (typeof Sexes)[number];

export const ActivityLevels = ['SEDENTARY', 'LIGHT', 'MODERATE', 'HIGH', 'VERY_HIGH'] as const;
export type ActivityLevel = (typeof ActivityLevels)[number];

export const DietRestrictions = [
  'VEGETARIAN',
  'VEGAN',
  'HALAL',
  'KOSHER',
  'GLUTEN_FREE',
  'LACTOSE_FREE',
  'NUT_ALLERGY',
  'SHELLFISH_ALLERGY',
  'EGG_ALLERGY',
] as const;
export type DietRestriction = (typeof DietRestrictions)[number];

export const GrapplingSports = ['WRESTLING', 'SAMBO', 'JUDO', 'BJJ'] as const;
export type GrapplingSport = (typeof GrapplingSports)[number];

export const Muscles = [
  'NECK',
  'SHOULDERS',
  'CHEST',
  'UPPER_BACK',
  'LATS',
  'LOWER_BACK',
  'BICEPS',
  'TRICEPS',
  'FOREARMS',
  'CORE',
  'OBLIQUES',
  'GLUTES',
  'HIP_FLEXORS',
  'ADDUCTORS',
  'ABDUCTORS',
  'QUADRICEPS',
  'HAMSTRINGS',
  'CALVES',
  'FULL_BODY',
] as const;
export type Muscle = (typeof Muscles)[number];

export const Difficulties = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
export type Difficulty = (typeof Difficulties)[number];

export const MeasureTypes = ['REPS', 'TIME', 'ROUNDS', 'DISTANCE'] as const;
export type MeasureType = (typeof MeasureTypes)[number];

export const WikiCategories = [
  'MACRONUTRIENT',
  'MICRONUTRIENT',
  'HYDRATION',
  'SUPPLEMENT',
  'TRAINING_CONCEPT',
] as const;
export type WikiCategory = (typeof WikiCategories)[number];

export const EvidenceLevels = ['STRONG', 'MODERATE', 'LIMITED', 'INSUFFICIENT'] as const;
export type EvidenceLevel = (typeof EvidenceLevels)[number];

export const WadaStatuses = ['PERMITTED', 'PROHIBITED', 'MONITORED', 'CHECK_PRODUCT'] as const;
export type WadaStatus = (typeof WadaStatuses)[number];
