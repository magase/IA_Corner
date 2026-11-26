import { describe, expect, it } from 'vitest';
import {
  normalizeEquipment,
  normalizePagination,
  normalizeSearch,
  requiresHealthDisclaimer,
} from './catalog-filters.js';

describe('catalog filters', () => {
  it('defaults and validates pagination', () => {
    expect(normalizePagination(null, null)).toEqual({ page: 1, pageSize: 20 });
    expect(() => normalizePagination(0, 10)).toThrow(
      expect.objectContaining({ reason: 'INVALID_PAGE' }),
    );
    expect(() => normalizePagination(1, 51)).toThrow(
      expect.objectContaining({ reason: 'INVALID_PAGE_SIZE' }),
    );
  });

  it('normalizes search', () => {
    expect(normalizeSearch('  sentadilla   búlgara ')).toBe('sentadilla búlgara');
    expect(normalizeSearch('   ')).toBeNull();
    expect(() => normalizeSearch('x'.repeat(81))).toThrow();
  });

  it('full gym means no equipment filter; bodyweight is always available', () => {
    expect(normalizeEquipment(['DUMBBELLS', 'FULL_GYM'])).toBeNull();
    expect(normalizeEquipment([])).toBeNull();
    expect(normalizeEquipment(['DUMBBELLS'])).toEqual(['DUMBBELLS', 'NONE']);
  });

  it('health disclaimer for nutrition and supplements only', () => {
    expect(requiresHealthDisclaimer('SUPPLEMENT')).toBe(true);
    expect(requiresHealthDisclaimer('HYDRATION')).toBe(true);
    expect(requiresHealthDisclaimer('TRAINING_CONCEPT')).toBe(false);
  });
});
