import { ValidationError } from '../../../shared/domain/errors.js';

export interface WorkoutEntryInput {
  exerciseSlug: string;
  setIndex: number;
  reps: number | null;
  weightKg: number | null;
  seconds: number | null;
  rounds: number | null;
  rpe: number | null;
}

export interface WorkoutLogInput {
  performedAt: Date;
  sessionId: string | null;
  durationMin: number | null;
  rpe: number | null;
  feeling: number | null;
  notes: string | null;
  entries: WorkoutEntryInput[];
}

export const MAX_ENTRIES = 100;

const range = (field: string, v: number | null, min: number, max: number, int = true) => {
  if (v === null) return;
  if (!Number.isFinite(v) || v < min || v > max || (int && !Number.isInteger(v))) {
    throw new ValidationError(`${field} debe estar entre ${min} y ${max}`, 'OUT_OF_RANGE', {
      field,
      min,
      max,
    });
  }
};

export function validateWorkout(w: WorkoutLogInput, now: Date): WorkoutLogInput {
  const t = w.performedAt.getTime();
  if (Number.isNaN(t) || t > now.getTime() + 24 * 3600_000 || t < Date.UTC(2000, 0, 1)) {
    throw new ValidationError('Fecha del entrenamiento no válida', 'INVALID_PERFORMED_AT');
  }
  range('durationMin', w.durationMin, 1, 600);
  range('rpe', w.rpe, 1, 10);
  range('feeling', w.feeling, 1, 5);
  if (w.entries.length > MAX_ENTRIES) {
    throw new ValidationError(`Máximo ${MAX_ENTRIES} series por registro`, 'TOO_MANY_ENTRIES');
  }
  for (const e of w.entries) {
    range('setIndex', e.setIndex, 1, 50);
    range('reps', e.reps, 0, 1000);
    range('weightKg', e.weightKg, 0, 500, false);
    range('seconds', e.seconds, 1, 7200);
    range('rounds', e.rounds, 1, 50);
    range('rpe', e.rpe, 1, 10);
    if (e.reps === null && e.seconds === null && e.rounds === null) {
      throw new ValidationError('Cada serie necesita repeticiones, tiempo o rounds', 'EMPTY_ENTRY');
    }
  }
  const notes = w.notes?.trim() ?? '';
  return {
    ...w,
    notes: notes.length ? notes : null,
    entries: w.entries.map((e) => ({
      ...e,
      weightKg: e.weightKg === null ? null : Math.round(e.weightKg * 100) / 100,
    })),
  };
}
