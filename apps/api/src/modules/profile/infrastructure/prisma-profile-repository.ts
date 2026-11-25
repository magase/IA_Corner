import type { DietRestriction } from '@corner/shared';
import { Prisma, type PrismaClient } from '@prisma/client';
import { ForbiddenError, ValidationError } from '../../../shared/domain/errors.js';
import type {
  CatalogReader,
  HealthConsentReader,
  ProfileRepository,
} from '../application/ports.js';
import type { AthleteProfile } from '../domain/athlete-profile.js';

export class PrismaProfileRepository implements ProfileRepository {
  constructor(private readonly db: PrismaClient) {}

  async findByUserId(userId: string): Promise<AthleteProfile | null> {
    const p = await this.db.athleteProfile.findUnique({
      where: { userId },
      include: {
        sports: { include: { sport: true } },
        equipment: { include: { equipment: true } },
        dietRestrictions: true,
      },
    });
    if (!p) return null;
    return {
      sex: p.sex,
      heightCm: p.heightCm,
      weightKg: Number(p.weightKg),
      bodyFatPct: p.bodyFatPct === null ? null : Number(p.bodyFatPct),
      level: p.level,
      goal: p.goal,
      activityLevel: p.activityLevel,
      daysPerWeek: p.daysPerWeek,
      sessionMinutes: p.sessionMinutes,
      injuriesNotes: p.injuriesNotes,
      sports: p.sports.map((s) => ({ code: s.sport.code, level: s.level })),
      equipment: p.equipment.map((e) => e.equipment.code),
      dietRestrictions: p.dietRestrictions.map((d) => d.restriction as DietRestriction),
    };
  }

  async upsert(userId: string, profile: AthleteProfile): Promise<void> {
    try {
      await this.upsertOnce(userId, profile);
    } catch (e) {
      // Interbloqueo o conflicto de escritura transitorio: un reintento basta.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(e.code)
      ) {
        await this.upsertOnce(userId, profile);
        return;
      }
      throw e;
    }
  }

  private async upsertOnce(userId: string, profile: AthleteProfile): Promise<void> {
    const { sports, equipment, dietRestrictions, ...scalars } = profile;
    await this.db.$transaction(async (tx) => {
      // Bloquea la fila del usuario: serializa escrituras concurrentes del perfil y la
      // retirada del consentimiento, y vuelve a comprobarlo dentro de la transacción.
      const rows = await tx.$queryRaw<{ healthDataConsentAt: Date | null }[]>`
        SELECT healthDataConsentAt FROM User WHERE id = ${userId} FOR UPDATE`;
      if (!rows[0]?.healthDataConsentAt) {
        throw new ForbiddenError(
          'Necesitamos tu consentimiento para tratar datos de salud',
          'HEALTH_CONSENT_REQUIRED',
        );
      }
      const [sportRows, equipmentRows] = await Promise.all([
        tx.sport.findMany({ where: { code: { in: sports.map((s) => s.code) } } }),
        tx.equipment.findMany({ where: { code: { in: equipment } } }),
      ]);
      const sportIds = new Map(sportRows.map((s) => [s.code, s.id]));
      const equipmentIds = new Map(equipmentRows.map((e) => [e.code, e.id]));
      const idOf = (ids: Map<string, string>, code: string): string => {
        const id = ids.get(code);
        if (!id) throw new ValidationError('Catálogo no válido', 'UNKNOWN_CATALOG_CODE', { code });
        return id;
      };

      const row = await tx.athleteProfile.upsert({
        where: { userId },
        create: { userId, ...scalars },
        update: scalars,
      });
      await tx.profileSport.deleteMany({ where: { profileId: row.id } });
      await tx.profileEquipment.deleteMany({ where: { profileId: row.id } });
      await tx.profileDietRestriction.deleteMany({ where: { profileId: row.id } });
      await tx.profileSport.createMany({
        data: sports.map((s) => ({
          profileId: row.id,
          sportId: idOf(sportIds, s.code),
          level: s.level,
        })),
      });
      if (equipment.length) {
        await tx.profileEquipment.createMany({
          data: equipment.map((c) => ({ profileId: row.id, equipmentId: idOf(equipmentIds, c) })),
        });
      }
      if (dietRestrictions.length) {
        await tx.profileDietRestriction.createMany({
          data: dietRestrictions.map((restriction) => ({ profileId: row.id, restriction })),
        });
      }
    });
  }
}

export class PrismaCatalogReader implements CatalogReader {
  constructor(private readonly db: PrismaClient) {}

  async enabledSportCodes() {
    const rows = await this.db.sport.findMany({
      where: { isEnabled: true, category: 'STRIKING' },
      select: { code: true },
    });
    return new Set(rows.map((r) => r.code));
  }

  async equipmentCodes() {
    const rows = await this.db.equipment.findMany({ select: { code: true } });
    return new Set(rows.map((r) => r.code));
  }
}

export class PrismaHealthConsentReader implements HealthConsentReader {
  constructor(private readonly db: PrismaClient) {}

  async hasHealthConsent(userId: string) {
    const u = await this.db.user.findUnique({
      where: { id: userId },
      select: { healthDataConsentAt: true },
    });
    return u?.healthDataConsentAt != null;
  }
}
