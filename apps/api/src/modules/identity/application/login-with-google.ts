import type { Locale } from '@corner/shared';
import type { Clock, IdGenerator } from '../../../shared/application/ports.js';
import { UnauthorizedError, ValidationError } from '../../../shared/domain/errors.js';
import { parseBirthDate } from '../domain/age.js';
import { normalizeEmail } from '../domain/email.js';
import { createUser } from '../domain/user.js';
import type { GoogleTokenVerifier, RefreshTokenStore, UserRepository } from './ports.js';
import type { Session, SessionContext, SessionIssuer } from './session-issuer.js';

export interface LoginWithGoogleInput {
  idToken: string;
  /** Solo necesarios la primera vez (alta): Google no facilita la fecha de nacimiento. */
  birthDate: string | null;
  displayName: string | null;
  acceptTerms: boolean;
  locale: Locale;
}

export class LoginWithGoogle {
  constructor(
    private readonly users: UserRepository,
    private readonly google: GoogleTokenVerifier,
    private readonly refreshTokens: RefreshTokenStore,
    private readonly sessions: SessionIssuer,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: LoginWithGoogleInput, ctx: SessionContext): Promise<Session> {
    const g = await this.google.verify(input.idToken);
    if (!g.emailVerified) {
      throw new UnauthorizedError(
        'El email de Google no está verificado',
        'GOOGLE_EMAIL_UNVERIFIED',
      );
    }
    const email = normalizeEmail(g.email);

    const linked = await this.users.findByIdentity('GOOGLE', g.sub);
    if (linked) return this.sessions.issue(linked, ctx);

    const byEmail = await this.users.findByEmail(email);
    if (byEmail) {
      if (byEmail.emailVerifiedAt) {
        await this.users.linkIdentity(byEmail.id, 'GOOGLE', g.sub);
        return this.sessions.issue(byEmail, ctx);
      }
      // Email nunca verificado: pudo registrarlo un tercero. Google demuestra la propiedad,
      // así que se anula la contraseña previa y se cierran todas sus sesiones.
      const now = this.clock.now();
      await this.users.claimUnverifiedAccount(byEmail.id, 'GOOGLE', g.sub, now);
      await this.refreshTokens.revokeAllForUser(byEmail.id, now);
      const claimed = { ...byEmail, passwordHash: null, emailVerifiedAt: now };
      return this.sessions.issue(claimed, ctx);
    }

    if (!input.birthDate || !input.acceptTerms) {
      throw new ValidationError(
        'Completa tu registro: fecha de nacimiento y aceptación de términos',
        'SIGNUP_DATA_REQUIRED',
        { email, suggestedName: g.name },
      );
    }
    const user = createUser({
      id: this.ids.next(),
      email,
      displayName: input.displayName ?? g.name ?? email.split('@')[0] ?? 'Atleta',
      locale: input.locale,
      birthDate: parseBirthDate(input.birthDate),
      passwordHash: null,
      emailVerified: true,
      now: this.clock.now(),
    });
    await this.users.create(user, { provider: 'GOOGLE', providerId: g.sub });
    return this.sessions.issue(user, ctx);
  }
}
