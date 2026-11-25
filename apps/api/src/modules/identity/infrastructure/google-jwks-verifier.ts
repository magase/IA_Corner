import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { UnauthorizedError } from '../../../shared/domain/errors.js';
import type { GoogleIdentity, GoogleTokenVerifier } from '../application/ports.js';

const GOOGLE_JWKS_URL = new URL('https://www.googleapis.com/oauth2/v3/certs');

/** Verifica ID tokens de Google Identity Services con las claves públicas de Google (cacheadas). */
export class GoogleJwksVerifier implements GoogleTokenVerifier {
  private readonly jwks: JWTVerifyGetKey;

  constructor(
    private readonly clientIds: readonly string[],
    jwks?: JWTVerifyGetKey,
  ) {
    this.jwks = jwks ?? createRemoteJWKSet(GOOGLE_JWKS_URL);
  }

  async verify(idToken: string): Promise<GoogleIdentity> {
    if (this.clientIds.length === 0) {
      throw new UnauthorizedError('El login con Google no está configurado', 'GOOGLE_DISABLED');
    }
    try {
      const { payload } = await jwtVerify(idToken, this.jwks, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: [...this.clientIds],
        algorithms: ['RS256'],
      });
      if (!payload.sub || typeof payload['email'] !== 'string') throw new Error('incomplete');
      return {
        sub: payload.sub,
        email: payload['email'],
        emailVerified: payload['email_verified'] === true,
        name: typeof payload['name'] === 'string' ? payload['name'] : null,
      };
    } catch {
      throw new UnauthorizedError('Token de Google no válido', 'INVALID_GOOGLE_TOKEN');
    }
  }
}
