import { describe, expect, it } from 'vitest';
import { resolveFeatures, TIER_ENTITLEMENTS } from './entitlements.js';

describe('entitlements', () => {
  it('free tier limits workout log to 10 rows', () => {
    expect(TIER_ENTITLEMENTS.FREE.limits.workoutLogRows).toBe(10);
  });

  it('free tier has no round timer nor calendar', () => {
    const f = resolveFeatures('FREE', []);
    expect(f.has('ROUND_TIMER')).toBe(false);
    expect(f.has('CALENDAR')).toBe(false);
    expect(f.has('WIKI')).toBe(true);
  });

  it('add-ons only apply to premium', () => {
    expect(resolveFeatures('FREE', ['RECIPES']).has('RECIPES')).toBe(false);
    expect(resolveFeatures('PREMIUM', ['RECIPES']).has('RECIPES')).toBe(true);
  });

  it('premium has unlimited log rows', () => {
    expect(TIER_ENTITLEMENTS.PREMIUM.limits.workoutLogRows).toBeNull();
  });
});
