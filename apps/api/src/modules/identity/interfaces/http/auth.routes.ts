import { CLIENT_HEADER, type AuthSessionResponse } from '@corner/shared';
import { serializeCookie } from '../../../../shared/infrastructure/http/cookies.js';
import { HttpError } from '../../../../shared/infrastructure/http/http-error.js';
import type { RateLimiter } from '../../../../shared/infrastructure/http/rate-limiter.js';
import type { Router } from '../../../../shared/infrastructure/http/router.js';
import type { HttpRequest, HttpResponse } from '../../../../shared/infrastructure/http/types.js';
import { enforceRateLimit, parseBody } from '../../../../shared/infrastructure/http/validation.js';
import type { LoginWithEmail } from '../../application/login-with-email.js';
import type { LoginWithGoogle } from '../../application/login-with-google.js';
import type { Logout } from '../../application/logout.js';
import type { RefreshSession } from '../../application/refresh-session.js';
import type { RegisterWithEmail } from '../../application/register-with-email.js';
import type { Session, SessionContext } from '../../application/session-issuer.js';
import { GoogleLoginSchema, LoginSchema, RegisterSchema } from './schemas.js';

export const REFRESH_COOKIE = 'corner_rt';
const COOKIE_PATH = '/api/v1/auth';

export interface AuthRoutesDeps {
  register: RegisterWithEmail;
  login: LoginWithEmail;
  google: LoginWithGoogle;
  refresh: RefreshSession;
  logout: Logout;
  /** Credenciales (register/login/google): estricto. */
  limiter: RateLimiter;
  /** Refresh: generoso (varias pestañas, recargas). */
  refreshLimiter: RateLimiter;
  cookieSecure: boolean;
  now: () => Date;
}

const sessionCtx = (req: HttpRequest): SessionContext => {
  const ua = req.headers['user-agent'];
  return { userAgent: typeof ua === 'string' ? ua : null };
};

/** Cabecera personalizada: fuerza preflight CORS, así que un origen ajeno no puede usar la cookie. */
function requireClientHeader(req: HttpRequest): void {
  if (req.headers[CLIENT_HEADER.toLowerCase()] !== '1') {
    throw new HttpError(403, 'CLIENT_HEADER_REQUIRED');
  }
}

export function registerAuthRoutes(router: Router, d: AuthRoutesDeps): void {
  const cookie = (value: string, maxAgeSec: number) =>
    serializeCookie(REFRESH_COOKIE, value, {
      maxAgeSec,
      path: COOKIE_PATH,
      secure: d.cookieSecure,
      httpOnly: true,
      sameSite: 'Strict',
    });

  const respond = (s: Session, status = 200): HttpResponse => {
    const body: AuthSessionResponse = {
      accessToken: s.accessToken,
      expiresIn: s.expiresIn,
      user: s.user,
    };
    const maxAge = Math.max(
      0,
      Math.floor((s.refreshExpiresAt.getTime() - d.now().getTime()) / 1000),
    );
    return {
      status,
      body,
      headers: { 'Set-Cookie': cookie(s.refreshToken, maxAge), 'Cache-Control': 'no-store' },
    };
  };
  const clear = (): HttpResponse => ({
    status: 204,
    headers: { 'Set-Cookie': cookie('', 0), 'Cache-Control': 'no-store' },
  });

  router.post('/api/v1/auth/register', async (req) => {
    enforceRateLimit(req, d.limiter, 'auth');
    const input = parseBody(RegisterSchema, req.body);
    return respond(await d.register.execute(input, sessionCtx(req)), 201);
  });

  router.post('/api/v1/auth/login', async (req) => {
    enforceRateLimit(req, d.limiter, 'auth');
    const input = parseBody(LoginSchema, req.body);
    return respond(await d.login.execute(input, sessionCtx(req)));
  });

  router.post('/api/v1/auth/google', async (req) => {
    enforceRateLimit(req, d.limiter, 'auth');
    const input = parseBody(GoogleLoginSchema, req.body);
    return respond(await d.google.execute(input, sessionCtx(req)));
  });

  router.post('/api/v1/auth/refresh', async (req) => {
    requireClientHeader(req);
    enforceRateLimit(req, d.refreshLimiter, 'refresh');
    return respond(await d.refresh.execute(req.cookies[REFRESH_COOKIE], sessionCtx(req)));
  });

  router.post('/api/v1/auth/logout', async (req) => {
    requireClientHeader(req);
    await d.logout.execute(req.cookies[REFRESH_COOKIE]);
    return clear();
  });
}
