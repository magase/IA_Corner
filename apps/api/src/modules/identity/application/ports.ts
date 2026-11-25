import type { IdentityProvider, User } from '../domain/user.js';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByIdentity(provider: IdentityProvider, providerId: string): Promise<User | null>;
  /** Crea el usuario, su identidad y una suscripción FREE. Lanza ConflictError si el email existe. */
  create(user: User, identity: { provider: IdentityProvider; providerId: string }): Promise<void>;
  linkIdentity(userId: string, provider: IdentityProvider, providerId: string): Promise<void>;
  /**
   * El proveedor (Google) demuestra la propiedad de un email que nunca se verificó:
   * vincula la identidad, marca el email como verificado y ANULA la contraseña existente
   * (pudo crearla un tercero). Evita el secuestro previo de cuentas.
   */
  claimUnverifiedAccount(
    userId: string,
    provider: IdentityProvider,
    providerId: string,
    at: Date,
  ): Promise<void>;
  /** `null` = retirar consentimiento: también borra los datos de salud (perfil, métricas). */
  setHealthConsent(userId: string, at: Date | null): Promise<void>;
  delete(userId: string): Promise<void>;
  exportData(userId: string): Promise<Record<string, unknown>>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}

export interface AccessTokenService {
  issue(userId: string): Promise<{ token: string; expiresIn: number }>;
  /** Lanza UnauthorizedError si el token no es válido o ha caducado. */
  verify(token: string): Promise<{ userId: string }>;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  userAgent: string | null;
}

export interface RefreshTokenStore {
  save(record: RefreshTokenRecord): Promise<void>;
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  /** Revoca solo si sigue activo. Devuelve false si ya estaba revocado (carrera / reutilización). */
  revoke(id: string, at: Date): Promise<boolean>;
  revokeFamily(familyId: string, at: Date): Promise<void>;
  revokeAllForUser(userId: string, at: Date): Promise<void>;
}

/** Tokens opacos aleatorios; en BD solo se guarda su hash. */
export interface OpaqueTokenGenerator {
  generate(): string;
  hash(token: string): string;
}

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

export interface GoogleTokenVerifier {
  /** Lanza UnauthorizedError si el ID token no es válido. */
  verify(idToken: string): Promise<GoogleIdentity>;
}
