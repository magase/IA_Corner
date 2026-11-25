import type { ServerResponse } from 'node:http';

/** Equivalente mínimo de helmet para una API JSON. */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Cross-Origin-Resource-Policy': 'same-site',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

export function applySecurityHeaders(res: ServerResponse): void {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  res.removeHeader('X-Powered-By');
}

/** CORS con lista blanca; devuelve true si el origen está permitido. */
export function applyCors(
  res: ServerResponse,
  origin: string | undefined,
  allowed: readonly string[],
): boolean {
  if (!origin) return true;
  if (!allowed.includes(origin)) return false;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type,Authorization,Accept-Language,X-Corner-Client',
  );
  res.setHeader('Access-Control-Max-Age', '600');
  return true;
}
