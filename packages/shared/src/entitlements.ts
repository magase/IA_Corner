import type { AddOn, SubscriptionTier } from './enums.js';

export const Features = [
  'DETERMINISTIC_PLAN',
  'AI_PERSONALIZED_PLAN',
  'WORKOUT_LOG',
  'ROUND_TIMER',
  'CALENDAR',
  'BODY_METRICS',
  'GENERAL_NUTRITION',
  'MACRO_CALCULATOR',
  'MEAL_PLAN',
  'DIET_RESTRICTIONS',
  'RECIPES',
  'FOOD_LOG',
  'WIKI',
] as const;
export type Feature = (typeof Features)[number];

export interface TierEntitlements {
  features: readonly Feature[];
  limits: { workoutLogRows: number | null };
}

const FREE: TierEntitlements = {
  features: ['DETERMINISTIC_PLAN', 'WORKOUT_LOG', 'GENERAL_NUTRITION', 'WIKI'],
  limits: { workoutLogRows: 10 },
};

const PREMIUM: TierEntitlements = {
  features: [
    ...FREE.features,
    'AI_PERSONALIZED_PLAN',
    'ROUND_TIMER',
    'CALENDAR',
    'BODY_METRICS',
    'MACRO_CALCULATOR',
    'MEAL_PLAN',
    'DIET_RESTRICTIONS',
  ],
  limits: { workoutLogRows: null },
};

/** Fuente única de verdad del freemium: cambiar aquí, no en el código de negocio. */
export const TIER_ENTITLEMENTS: Record<SubscriptionTier, TierEntitlements> = { FREE, PREMIUM };

/** Los add-ons se compran aparte y requieren PREMIUM. */
export const ADD_ON_FEATURES: Record<AddOn, Feature> = { RECIPES: 'RECIPES', FOOD_LOG: 'FOOD_LOG' };

export function resolveFeatures(tier: SubscriptionTier, addOns: readonly AddOn[]): Set<Feature> {
  const features = new Set<Feature>(TIER_ENTITLEMENTS[tier].features);
  if (tier === 'PREMIUM') addOns.forEach((a) => features.add(ADD_ON_FEATURES[a]));
  return features;
}
