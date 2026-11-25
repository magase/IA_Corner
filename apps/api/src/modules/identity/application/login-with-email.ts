import { UnauthorizedError } from '../../../shared/domain/errors.js';
import type { PasswordHasher, UserRepository } from './ports.js';
import type { Session, SessionContext, SessionIssuer } from './session-issuer.js';

export class LoginWithEmail {
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionIssuer,
  ) {}

  async execute(input: { email: string; password: string }, ctx: SessionContext): Promise<Session> {
    const email = input.email.trim().toLowerCase();
    const user = email.length <= 254 ? await this.users.findByEmail(email) : null;

    if (!user?.passwordHash) {
      // Igualar tiempos para no revelar qué emails existen.
      this.dummyHash ??= this.hasher.hash('corner-timing-equalizer');
      await this.hasher.verify(await this.dummyHash, input.password);
      throw invalid();
    }
    if (!(await this.hasher.verify(user.passwordHash, input.password))) throw invalid();
    return this.sessions.issue(user, ctx);
  }
}

const invalid = () =>
  new UnauthorizedError('Email o contraseña incorrectos', 'INVALID_CREDENTIALS');
