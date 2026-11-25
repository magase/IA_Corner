import type { RateLimiter } from '../../../../shared/infrastructure/http/rate-limiter.js';
import type { Router } from '../../../../shared/infrastructure/http/router.js';
import { enforceRateLimit, parseBody } from '../../../../shared/infrastructure/http/validation.js';
import type {
  DeleteAccount,
  ExportMyData,
  GetMe,
  SetHealthConsent,
} from '../../application/account.js';
import type { Authenticator } from './auth-guard.js';
import { REFRESH_COOKIE } from './auth.routes.js';
import { ConsentSchema, DeleteAccountSchema } from './schemas.js';

export interface MeRoutesDeps {
  authenticate: Authenticator;
  getMe: GetMe;
  setHealthConsent: SetHealthConsent;
  exportData: ExportMyData;
  deleteAccount: DeleteAccount;
  /** Limita la reautenticación (verificación de contraseña) por IP y por usuario. */
  reauthLimiter: RateLimiter;
  cookieSecure: boolean;
}

const noStore = { 'Cache-Control': 'no-store' };

export function registerMeRoutes(router: Router, d: MeRoutesDeps): void {
  router.get('/api/v1/me', async (req) => {
    const userId = await d.authenticate(req);
    return { status: 200, body: await d.getMe.execute(userId), headers: noStore };
  });

  router.put('/api/v1/me/consents/health', async (req) => {
    const userId = await d.authenticate(req);
    const { accepted } = parseBody(ConsentSchema, req.body);
    await d.setHealthConsent.execute(userId, accepted);
    return { status: 204 };
  });

  router.get('/api/v1/me/export', async (req) => {
    const userId = await d.authenticate(req);
    return {
      status: 200,
      body: await d.exportData.execute(userId),
      headers: { ...noStore, 'Content-Disposition': 'attachment; filename="corner-export.json"' },
    };
  });

  router.delete('/api/v1/me', async (req) => {
    const userId = await d.authenticate(req);
    enforceRateLimit(req, d.reauthLimiter, 'reauth');
    enforceRateLimit({ ...req, ip: userId }, d.reauthLimiter, 'reauth-user');
    const proof = parseBody(DeleteAccountSchema, req.body);
    await d.deleteAccount.execute(userId, proof);
    const secure = d.cookieSecure ? '; Secure' : '';
    return {
      status: 204,
      headers: {
        'Set-Cookie': `${REFRESH_COOKIE}=; Max-Age=0; Path=/api/v1/auth; SameSite=Strict; HttpOnly${secure}`,
      },
    };
  });
}
