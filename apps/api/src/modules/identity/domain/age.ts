import { ValidationError } from '../../../shared/domain/errors.js';

export const MIN_AGE = 18;
const MAX_AGE = 120;

/** Parsea estrictamente YYYY-MM-DD (UTC) y rechaza fechas imposibles como 2001-02-30. */
export function parseBirthDate(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const invalid = () => new ValidationError('Fecha de nacimiento no válida', 'INVALID_BIRTHDATE');
  if (!m) throw invalid();
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    throw invalid();
  }
  return date;
}

export function ageOn(birth: Date, today: Date): number {
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age--;
  return age;
}

export function assertAdult(birth: Date, today: Date): void {
  if (birth.getTime() > today.getTime()) {
    throw new ValidationError('Fecha de nacimiento no válida', 'INVALID_BIRTHDATE');
  }
  const age = ageOn(birth, today);
  if (age > MAX_AGE)
    throw new ValidationError('Fecha de nacimiento no válida', 'INVALID_BIRTHDATE');
  if (age < MIN_AGE) {
    throw new ValidationError(`Debes tener al menos ${MIN_AGE} años`, 'UNDERAGE');
  }
}

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
