import { describe, expect, it } from 'vitest';
import {
  activityFromTraining,
  calculateTargets,
  generalGuidelines,
  mifflinStJeor,
  suggestSupplements,
} from './nutrition.js';

describe('nutrition domain', () => {
  it('Mifflin-St Jeor matches reference values', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 1780
    expect(mifflinStJeor('MALE', 80, 180, 30)).toBe(1780);
    // 10*60 + 6.25*165 - 5*25 - 161 = 1345.25
    expect(mifflinStJeor('FEMALE', 60, 165, 25)).toBeCloseTo(1345.25);
  });

  const male = {
    sex: 'MALE' as const,
    weightKg: 80,
    heightCm: 180,
    age: 30,
    activityLevel: 'HIGH' as const,
  };

  it('calculates consistent targets (macros add up to kcal ±10)', () => {
    const t = calculateTargets({
      ...male,
      goal: 'GENERAL_FITNESS',
      daysPerWeek: 4,
      sessionMinutes: 60,
    });
    expect(t.kcal).toBe(Math.round((1780 * 1.725) / 10) * 10);
    expect(t.proteinG).toBe(128);
    expect(Math.abs(t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9 - t.kcal)).toBeLessThanOrEqual(10);
  });

  it('uses the training volume when it implies more activity than declared', () => {
    const t = calculateTargets({
      ...male,
      activityLevel: 'SEDENTARY',
      goal: 'GENERAL_FITNESS',
      daysPerWeek: 6,
      sessionMinutes: 90,
    });
    expect(t.kcal).toBe(Math.round((1780 * 1.9) / 10) * 10);
    expect(activityFromTraining(3, 45)).toBe('LIGHT');
  });

  it('carbs match the high-volume guideline (>=5 g/kg) with fat above its floor', () => {
    const t = calculateTargets({
      ...male,
      activityLevel: 'MODERATE',
      goal: 'BODY_COMPOSITION',
      daysPerWeek: 5,
      sessionMinutes: 60,
    });
    expect(t.carbsG).toBeGreaterThanOrEqual(5 * 80);
    expect(t.fatG).toBeGreaterThanOrEqual(0.8 * 80);
    expect(Math.abs(t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9 - t.kcal)).toBeLessThanOrEqual(10);
  });

  it('never goes below a safe energy floor', () => {
    const t = calculateTargets({
      sex: 'FEMALE',
      weightKg: 45,
      heightCm: 150,
      age: 60,
      activityLevel: 'SEDENTARY',
      goal: 'BODY_COMPOSITION',
      daysPerWeek: 1,
      sessionMinutes: 30,
    });
    expect(t.kcal).toBeGreaterThanOrEqual(1500);
  });

  it('keeps any deficit moderate (max 10%) and fat above a safe floor', () => {
    const input = {
      sex: 'FEMALE' as const,
      weightKg: 60,
      heightCm: 165,
      age: 25,
      activityLevel: 'MODERATE' as const,
      daysPerWeek: 3,
      sessionMinutes: 60,
    };
    const maint = calculateTargets({ ...input, goal: 'GENERAL_FITNESS' });
    const comp = calculateTargets({ ...input, goal: 'BODY_COMPOSITION' });
    expect(comp.kcal / maint.kcal).toBeGreaterThanOrEqual(0.89);
    expect(comp.fatG).toBeGreaterThanOrEqual(0.8 * 60);
  });

  it('general guidelines have no calorie numbers and adapt to volume', () => {
    const g = generalGuidelines('CONDITIONING', 5);
    expect(g.map((x) => x.code)).toContain('CARBS_HIGH_VOLUME');
    expect(JSON.stringify(g)).not.toMatch(/kcal/i);
  });

  it('supplement suggestions are conservative and link to wiki slugs', () => {
    const s = suggestSupplements('STRENGTH_POWER', 3).map((x) => x.slug);
    expect(s).toContain('creatina-monohidrato');
    expect(s).not.toContain('cafeina');
    expect(suggestSupplements('CONDITIONING', 5).map((x) => x.slug)).toContain('cafeina');
  });
});
