import { ValidationError } from '../../../shared/domain/errors.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    throw new ValidationError('Email no válido', 'INVALID_EMAIL');
  }
  return email;
}
