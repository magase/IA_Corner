import type { Locale } from '@corner/shared';
import type { Clock, IdGenerator } from '../../../shared/application/ports.js';
import { ConflictError, ValidationError } from '../../../shared/domain/errors.js';
import { parseBirthDate } from '../domain/age.js';
import { normalizeEmail } from '../domain/email.js';
import { assertPasswordPolicy } from '../domain/password-policy.js';
import { createUser } from '../domain/user.js';
import type { PasswordHasher, UserRepository } from './ports.js';
import type { Session, SessionContext, SessionIssuer } from './session-issuer.js';

export interface RegisterWithEmailInput {
  email: string;
  password: string;
  displayName: string;
  birthDate: string;
  locale: Locale;
  acceptTerms: boolean;
}

export class RegisterWithEmail {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionIssuer,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: RegisterWithEmailInput, ctx: SessionContext): Promise<Session> {
    if (!input.acceptTerms) {
      throw new ValidationError(
        'Debes aceptar los términos y la política de privacidad',
        'TERMS_REQUIRED',
      );
    }
    const email = normalizeEmail(input.email);
    assertPasswordPolicy(input.password, email);
    const birthDate = parseBirthDate(input.birthDate);
    // Hash antes de comprobar si existe: mismo coste en ambos casos (no revela emails por tiempo).
    const passwordHash = await this.hasher.hash(input.password);

    if (await this.users.findByEmail(email)) {
      throw new ConflictError('Ya existe una cuenta con ese email', 'EMAIL_TAKEN');
    }

    const user = createUser({
      id: this.ids.next(),
      email,
      displayName: input.displayName,
      locale: input.locale,
      birthDate,
      passwordHash,
      emailVerified: false,
      now: this.clock.now(),
    });
    await this.users.create(user, { provider: 'EMAIL', providerId: email });
    return this.sessions.issue(user, ctx);
  }
}
