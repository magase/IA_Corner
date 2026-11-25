import { UnauthorizedError } from '../../../../shared/domain/errors.js';
import type { Authenticator } from '../../../../shared/infrastructure/http/types.js';
import type { AccessTokenService } from '../../application/ports.js';

export type { Authenticator };

/** Extrae y verifica el Bearer token; devuelve el userId. */
export function bearerAuthenticator(tokens: AccessTokenService): Authenticator {
  return async (req) => {
    const header = req.headers.authorization;
    const m = typeof header === 'string' ? /^Bearer\s+(\S+)$/i.exec(header) : null;
    if (!m?.[1]) throw new UnauthorizedError('Falta el token de acceso', 'MISSING_ACCESS_TOKEN');
    return (await tokens.verify(m[1])).userId;
  };
}
