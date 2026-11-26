import { Prisma, type PrismaClient, type User as UserRow } from '@prisma/client';
import { ConflictError } from '../../../shared/domain/errors.js';
import type { UserRepository } from '../application/ports.js';
import type { IdentityProvider, User } from '../domain/user.js';

const toUser = (r: UserRow): User => ({
  id: r.id,
  email: r.email,
  displayName: r.displayName,
  locale: r.locale === 'en' ? 'en' : 'es',
  birthDate: r.birthDate,
  passwordHash: r.passwordHash,
  emailVerifiedAt: r.emailVerifiedAt,
  healthDataConsentAt: r.healthDataConsentAt,
  createdAt: r.createdAt,
});

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly db: PrismaClient) {}

  async findById(id: string) {
    const r = await this.db.user.findFirst({ where: { id, deletedAt: null } });
    return r ? toUser(r) : null;
  }

  async findByEmail(email: string) {
    const r = await this.db.user.findFirst({ where: { email, deletedAt: null } });
    return r ? toUser(r) : null;
  }

  async findByIdentity(provider: IdentityProvider, providerId: string) {
    const i = await this.db.authIdentity.findUnique({
      where: { provider_providerId: { provider, providerId } },
      include: { user: true },
    });
    return i && !i.user.deletedAt ? toUser(i.user) : null;
  }

  async create(user: User, identity: { provider: IdentityProvider; providerId: string }) {
    try {
      await this.db.user.create({
        data: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          locale: user.locale,
          birthDate: user.birthDate,
          passwordHash: user.passwordHash,
          emailVerifiedAt: user.emailVerifiedAt,
          healthDataConsentAt: user.healthDataConsentAt,
          createdAt: user.createdAt,
          identities: { create: identity },
          subscription: { create: { tier: 'FREE', status: 'ACTIVE', provider: 'FAKE' } },
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictError('Ya existe una cuenta con ese email', 'EMAIL_TAKEN');
      }
      throw e;
    }
  }

  async linkIdentity(userId: string, provider: IdentityProvider, providerId: string) {
    await this.db.authIdentity.upsert({
      where: { provider_providerId: { provider, providerId } },
      create: { userId, provider, providerId },
      update: {},
    });
  }

  async claimUnverifiedAccount(
    userId: string,
    provider: IdentityProvider,
    providerId: string,
    at: Date,
  ) {
    await this.db.$transaction([
      this.db.authIdentity.deleteMany({ where: { userId, provider: 'EMAIL' } }),
      this.db.authIdentity.upsert({
        where: { provider_providerId: { provider, providerId } },
        create: { userId, provider, providerId },
        update: {},
      }),
      this.db.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: at, passwordHash: null },
      }),
    ]);
  }

  async setHealthConsent(userId: string, at: Date | null) {
    if (at) {
      await this.db.user.update({ where: { id: userId }, data: { healthDataConsentAt: at } });
      return;
    }
    // Primero la fila User (mismo orden de bloqueo que el upsert del perfil).
    await this.db.$transaction([
      this.db.user.update({ where: { id: userId }, data: { healthDataConsentAt: null } }),
      this.db.athleteProfile.deleteMany({ where: { userId } }),
      this.db.bodyMetric.deleteMany({ where: { userId } }),
      // Planes calculados a partir del perfil (peso, altura, edad…): también se eliminan.
      this.db.trainingPlan.deleteMany({ where: { userId } }),
      this.db.nutritionPlan.deleteMany({ where: { userId } }),
    ]);
  }

  async delete(userId: string) {
    // Borrado físico: las relaciones caen en cascada (RGPD, derecho de supresión).
    await this.db.user.delete({ where: { id: userId } });
  }

  async exportData(userId: string) {
    const u = await this.db.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        locale: true,
        birthDate: true,
        healthDataConsentAt: true,
        createdAt: true,
        identities: { select: { provider: true, createdAt: true } },
        subscription: { select: { tier: true, status: true, currentPeriodEnd: true } },
        addOns: { select: { addOn: true, activeUntil: true } },
        profile: {
          include: {
            sports: { include: { sport: { select: { code: true } } } },
            equipment: { include: { equipment: { select: { code: true } } } },
            dietRestrictions: true,
          },
        },
        trainingPlans: { include: { sessions: { include: { exercises: true } } } },
        workoutLogs: { include: { entries: true } },
        bodyMetrics: true,
        nutritionPlans: { include: { meals: true, supplements: true } },
        foodLogs: true,
      },
    });
    return { exportedAt: new Date().toISOString(), ...u };
  }
}
