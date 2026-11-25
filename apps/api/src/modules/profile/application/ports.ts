import type { AthleteProfile } from '../domain/athlete-profile.js';

export interface ProfileRepository {
  findByUserId(userId: string): Promise<AthleteProfile | null>;
  upsert(userId: string, profile: AthleteProfile): Promise<void>;
}

export interface CatalogReader {
  /** Códigos de deportes activos en la app (grappling no lo está). */
  enabledSportCodes(): Promise<Set<string>>;
  equipmentCodes(): Promise<Set<string>>;
}

export interface HealthConsentReader {
  hasHealthConsent(userId: string): Promise<boolean>;
}
