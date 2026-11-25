import type { AddOn, SubscriptionTier } from '@corner/shared';

export interface UserPlan {
  tier: SubscriptionTier;
  addOns: AddOn[];
}

/** Puerto: qué plan tiene un usuario. El negocio deriva features con `resolveFeatures`. */
export interface EntitlementsReader {
  forUser(userId: string): Promise<UserPlan>;
}
