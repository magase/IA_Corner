import type { Locale, PublicUserDto } from '@corner/shared';
import { ValidationError } from '../../../shared/domain/errors.js';
import { assertAdult, formatDate } from './age.js';

export interface User {
  id: string;
  email: string;
  displayName: string;
  locale: Locale;
  birthDate: Date;
  passwordHash: string | null;
  /** null = email no verificado (alta con email). Google lo verifica. */
  emailVerifiedAt: Date | null;
  healthDataConsentAt: Date | null;
  createdAt: Date;
}

export type IdentityProvider = 'EMAIL' | 'GOOGLE';

export interface NewUserInput {
  id: string;
  email: string;
  displayName: string;
  locale: Locale;
  birthDate: Date;
  passwordHash: string | null;
  emailVerified: boolean;
  now: Date;
}

export function normalizeDisplayName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < 1 || name.length > 80) {
    throw new ValidationError(
      'El nombre debe tener entre 1 y 80 caracteres',
      'INVALID_DISPLAY_NAME',
    );
  }
  return name;
}

export function createUser(input: NewUserInput): User {
  assertAdult(input.birthDate, input.now);
  return {
    id: input.id,
    email: input.email,
    displayName: normalizeDisplayName(input.displayName),
    locale: input.locale,
    birthDate: input.birthDate,
    passwordHash: input.passwordHash,
    emailVerifiedAt: input.emailVerified ? input.now : null,
    healthDataConsentAt: null,
    createdAt: input.now,
  };
}

export function toPublicUser(u: User): PublicUserDto {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    locale: u.locale,
    birthDate: formatDate(u.birthDate),
    hasHealthConsent: u.healthDataConsentAt !== null,
    createdAt: u.createdAt.toISOString(),
  };
}
