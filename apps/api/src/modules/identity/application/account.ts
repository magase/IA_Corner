import { resolveFeatures, TIER_ENTITLEMENTS, type MeResponse } from '@corner/shared';
import type { EntitlementsReader } from '../../../shared/application/entitlements.js';
import type { Clock } from '../../../shared/application/ports.js';
import { NotFoundError, UnauthorizedError } from '../../../shared/domain/errors.js';
import { toPublicUser, type User } from '../domain/user.js';
import type { GoogleTokenVerifier, PasswordHasher, UserRepository } from './ports.js';

async function requireUser(users: UserRepository, userId: string): Promise<User> {
  const user = await users.findById(userId);
  if (!user) throw new NotFoundError('Usuario no encontrado', 'USER_NOT_FOUND');
  return user;
}

export class GetMe {
  constructor(
    private readonly users: UserRepository,
    private readonly entitlements: EntitlementsReader,
  ) {}

  async execute(userId: string): Promise<MeResponse> {
    const user = await requireUser(this.users, userId);
    const plan = await this.entitlements.forUser(userId);
    return {
      user: toPublicUser(user),
      plan: {
        tier: plan.tier,
        addOns: plan.addOns,
        features: [...resolveFeatures(plan.tier, plan.addOns)],
        limits: TIER_ENTITLEMENTS[plan.tier].limits,
      },
    };
  }
}

export class SetHealthConsent {
  constructor(
    private readonly users: UserRepository,
    private readonly clock: Clock,
  ) {}

  /** Retirar el consentimiento borra los datos de salud (RGPD art. 7.3 y 9). */
  async execute(userId: string, accepted: boolean): Promise<void> {
    await requireUser(this.users, userId);
    await this.users.setHealthConsent(userId, accepted ? this.clock.now() : null);
  }
}

export class ExportMyData {
  constructor(private readonly users: UserRepository) {}

  async execute(userId: string): Promise<Record<string, unknown>> {
    await requireUser(this.users, userId);
    return this.users.exportData(userId);
  }
}

export interface DeleteAccountProof {
  password: string | null;
  googleIdToken: string | null;
}

export class DeleteAccount {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly google: GoogleTokenVerifier,
  ) {}

  /**
   * Reautenticación obligatoria (es irreversible): contraseña si la cuenta la tiene;
   * si no, un ID token de Google reciente de la identidad vinculada.
   */
  async execute(userId: string, proof: DeleteAccountProof): Promise<void> {
    const user = await requireUser(this.users, userId);
    const denied = () =>
      new UnauthorizedError('No se pudo confirmar tu identidad', 'REAUTH_FAILED');
    if (user.passwordHash) {
      const ok =
        proof.password !== null && (await this.hasher.verify(user.passwordHash, proof.password));
      if (!ok) throw denied();
    } else {
      if (!proof.googleIdToken) throw denied();
      const g = await this.google.verify(proof.googleIdToken);
      const owner = await this.users.findByIdentity('GOOGLE', g.sub);
      if (owner?.id !== user.id) throw denied();
    }
    await this.users.delete(userId);
  }
}
