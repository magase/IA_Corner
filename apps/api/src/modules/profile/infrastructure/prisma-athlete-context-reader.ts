import type { PrismaClient } from '@prisma/client';
import type {
  AthleteContext,
  AthleteContextReader,
} from '../../../shared/application/athlete-context.js';
import { PrismaProfileRepository } from './prisma-profile-repository.js';

export class PrismaAthleteContextReader implements AthleteContextReader {
  private readonly profiles: PrismaProfileRepository;

  constructor(private readonly db: PrismaClient) {
    this.profiles = new PrismaProfileRepository(db);
  }

  async forUser(userId: string): Promise<AthleteContext | null> {
    const u = await this.db.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { birthDate: true, healthDataConsentAt: true },
    });
    if (!u) return null;
    const hasHealthConsent = u.healthDataConsentAt !== null;
    return {
      hasHealthConsent,
      birthDate: u.birthDate,
      // Sin consentimiento no se leen datos de salud.
      profile: hasHealthConsent ? await this.profiles.findByUserId(userId) : null,
    };
  }
}
