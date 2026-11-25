import type { AthleteProfileDto } from '@corner/shared';
import { ValidationError } from '../../../shared/domain/errors.js';

export type AthleteProfile = AthleteProfileDto;

const RANGES = {
  heightCm: [120, 230],
  weightKg: [35, 250],
  bodyFatPct: [3, 60],
  daysPerWeek: [1, 7],
  sessionMinutes: [15, 240],
} as const;

function inRange(field: keyof typeof RANGES, value: number): void {
  const [min, max] = RANGES[field];
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new ValidationError(`${field} debe estar entre ${min} y ${max}`, 'OUT_OF_RANGE', {
      field,
      min,
      max,
    });
  }
}

function assertUnique(field: string, values: readonly string[]): void {
  if (new Set(values).size !== values.length) {
    throw new ValidationError(`${field} contiene duplicados`, 'DUPLICATED_VALUES', { field });
  }
}

/** Reglas de negocio del perfil (independientes del transporte). */
export function validateProfile(p: AthleteProfile): AthleteProfile {
  inRange('heightCm', p.heightCm);
  inRange('weightKg', p.weightKg);
  if (p.bodyFatPct !== null) inRange('bodyFatPct', p.bodyFatPct);
  inRange('daysPerWeek', p.daysPerWeek);
  inRange('sessionMinutes', p.sessionMinutes);
  if (p.sports.length === 0) {
    throw new ValidationError('Elige al menos un deporte', 'SPORT_REQUIRED');
  }
  assertUnique(
    'sports',
    p.sports.map((s) => s.code),
  );
  assertUnique('equipment', p.equipment);
  assertUnique('dietRestrictions', p.dietRestrictions);
  const notes = p.injuriesNotes?.trim() ?? '';
  return {
    ...p,
    weightKg: Math.round(p.weightKg * 100) / 100,
    bodyFatPct: p.bodyFatPct === null ? null : Math.round(p.bodyFatPct * 10) / 10,
    injuriesNotes: notes.length ? notes : null,
  };
}
