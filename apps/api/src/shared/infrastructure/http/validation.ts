import type { z } from 'zod';
import { ValidationError } from '../../domain/errors.js';
import { HttpError } from './http-error.js';
import type { RateLimiter } from './rate-limiter.js';
import type { HttpRequest } from './types.js';

export function parseBody<S extends z.ZodTypeAny>(schema: S, body: unknown): z.output<S> {
  const r = schema.safeParse(body ?? {});
  if (!r.success) {
    const details = r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    throw new ValidationError('Datos no válidos', 'INVALID_BODY', details);
  }
  return r.data;
}

export function enforceRateLimit(req: HttpRequest, limiter: RateLimiter, scope: string): void {
  const r = limiter.hit(`${scope}:${req.ip}`);
  if (!r.allowed) {
    throw new HttpError(429, 'TOO_MANY_REQUESTS', { 'Retry-After': String(r.retryAfterSec) });
  }
}
