import { resolveFeatures } from '@corner/shared';
import type { EntitlementsReader } from '../../../shared/application/entitlements.js';
import {
  ForbiddenError,
  NotFoundError,
  PremiumRequiredError,
  ValidationError,
} from '../../../shared/domain/errors.js';
import { validateProfile, type AthleteProfile } from '../domain/athlete-profile.js';
import type { CatalogReader, HealthConsentReader, ProfileRepository } from './ports.js';

async function requireConsent(consent: HealthConsentReader, userId: string): Promise<void> {
  if (!(await consent.hasHealthConsent(userId))) {
    throw new ForbiddenError(
      'Necesitamos tu consentimiento para tratar datos de salud',
      'HEALTH_CONSENT_REQUIRED',
    );
  }
}

export class UpsertAthleteProfile {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly catalog: CatalogReader,
    private readonly consent: HealthConsentReader,
    private readonly entitlements: EntitlementsReader,
  ) {}

  async execute(userId: string, input: AthleteProfile): Promise<AthleteProfile> {
    await requireConsent(this.consent, userId);
    const profile = validateProfile(input);

    const [sports, equipment] = await Promise.all([
      this.catalog.enabledSportCodes(),
      this.catalog.equipmentCodes(),
    ]);
    const badSports = profile.sports.map((s) => s.code).filter((c) => !sports.has(c));
    if (badSports.length) {
      throw new ValidationError('Deporte no disponible', 'UNKNOWN_SPORT', { codes: badSports });
    }
    const badEquipment = profile.equipment.filter((c) => !equipment.has(c));
    if (badEquipment.length) {
      throw new ValidationError('Material no reconocido', 'UNKNOWN_EQUIPMENT', {
        codes: badEquipment,
      });
    }

    if (profile.dietRestrictions.length) {
      const plan = await this.entitlements.forUser(userId);
      if (!resolveFeatures(plan.tier, plan.addOns).has('DIET_RESTRICTIONS')) {
        throw new PremiumRequiredError(
          'Las restricciones dietéticas son una función premium',
          'DIET_RESTRICTIONS',
        );
      }
    }

    await this.profiles.upsert(userId, profile);
    return profile;
  }
}

export class GetAthleteProfile {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly consent: HealthConsentReader,
  ) {}

  async execute(userId: string): Promise<AthleteProfile> {
    await requireConsent(this.consent, userId);
    const profile = await this.profiles.findByUserId(userId);
    if (!profile) throw new NotFoundError('Aún no has completado tu perfil', 'PROFILE_NOT_FOUND');
    return profile;
  }
}
