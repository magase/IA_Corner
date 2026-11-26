import type { AthleteProfileDto } from '@corner/shared';
import { ForbiddenError, NotFoundError } from '../domain/errors.js';

export interface AthleteContext {
  hasHealthConsent: boolean;
  birthDate: Date;
  profile: AthleteProfileDto | null;
}

/** Puerto: datos del atleta necesarios para generar planes. */
export interface AthleteContextReader {
  forUser(userId: string): Promise<AthleteContext | null>;
}

/** Los planes derivan de datos de salud: leerlos también exige consentimiento vigente. */
export async function requireHealthConsent(
  reader: AthleteContextReader,
  userId: string,
): Promise<void> {
  const ctx = await reader.forUser(userId);
  if (!ctx) throw new NotFoundError('Usuario no encontrado', 'USER_NOT_FOUND');
  if (!ctx.hasHealthConsent) {
    throw new ForbiddenError(
      'Necesitamos tu consentimiento para tratar datos de salud',
      'HEALTH_CONSENT_REQUIRED',
    );
  }
}

/** Los planes usan datos de salud: exigen consentimiento y perfil completo. */
export async function requireAthlete(
  reader: AthleteContextReader,
  userId: string,
): Promise<{ profile: AthleteProfileDto; birthDate: Date }> {
  const ctx = await reader.forUser(userId);
  if (!ctx) throw new NotFoundError('Usuario no encontrado', 'USER_NOT_FOUND');
  if (!ctx.hasHealthConsent) {
    throw new ForbiddenError(
      'Necesitamos tu consentimiento para tratar datos de salud',
      'HEALTH_CONSENT_REQUIRED',
    );
  }
  if (!ctx.profile)
    throw new NotFoundError('Completa tu perfil para generar un plan', 'PROFILE_NOT_FOUND');
  return { profile: ctx.profile, birthDate: ctx.birthDate };
}
