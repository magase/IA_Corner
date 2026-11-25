import { jwtVerify, SignJWT } from 'jose';
import { UnauthorizedError } from '../../../shared/domain/errors.js';
import type { AccessTokenService } from '../application/ports.js';

const ISSUER = 'corner-api';
const AUDIENCE = 'corner-app';

export class JoseAccessTokenService implements AccessTokenService {
  private readonly key: Uint8Array;

  constructor(
    secret: string,
    private readonly ttlSec = 15 * 60,
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  async issue(userId: string) {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${this.ttlSec}s`)
      .sign(this.key);
    return { token, expiresIn: this.ttlSec };
  }

  async verify(token: string) {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ['HS256'],
      });
      if (!payload.sub) throw new Error('missing sub');
      return { userId: payload.sub };
    } catch {
      throw new UnauthorizedError('Token no válido o caducado', 'INVALID_ACCESS_TOKEN');
    }
  }
}
