import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { DomainError } from '../../domain/errors.js';
import { parseCookies } from './cookies.js';
import { HttpError } from './http-error.js';
import type { RateLimiter } from './rate-limiter.js';
import type { Router } from './router.js';
import { applyCors, applySecurityHeaders } from './security.js';
import type { HttpResponse } from './types.js';

const MAX_BODY_BYTES = 100 * 1024;

const STATUS_BY_CODE: Record<string, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  PREMIUM_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
};

export interface ServerOptions {
  router: Router;
  corsOrigins: readonly string[];
  rateLimiter: RateLimiter;
  /**
   * Número de proxies inversos propios delante de la API (0 = no confiar en X-Forwarded-For).
   * La IP del cliente es la entrada N-ésima empezando por la DERECHA: las de la izquierda
   * las controla el cliente.
   */
  trustProxyHops: number;
  logger?: { error: (msg: string, err?: unknown) => void };
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'PAYLOAD_TOO_LARGE');
    chunks.push(chunk as Buffer);
  }
  if (size === 0) return undefined;
  if (!req.headers['content-type']?.includes('application/json')) {
    throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE');
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'INVALID_JSON');
  }
}

export function clientIp(
  remoteAddress: string | undefined,
  forwardedFor: string | string[] | undefined,
  hops: number,
): string {
  if (hops > 0 && forwardedFor) {
    const chain = (Array.isArray(forwardedFor) ? forwardedFor.join(',') : forwardedFor)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const ip = chain[chain.length - hops];
    if (ip) return ip;
  }
  return remoteAddress ?? 'unknown';
}

function send(res: ServerResponse, r: HttpResponse): void {
  for (const [k, v] of Object.entries(r.headers ?? {})) res.setHeader(k, v);
  if (r.body === undefined) {
    res.writeHead(r.status).end();
    return;
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.writeHead(r.status).end(JSON.stringify(r.body));
}

function domainErrorBody(err: DomainError): Record<string, unknown> {
  const body: Record<string, unknown> = { error: err.code, message: err.message };
  if (err.reason !== undefined) body['reason'] = err.reason;
  if (err.details !== undefined) body['details'] = err.details;
  return body;
}

export function buildServer(opts: ServerOptions): Server {
  return createServer(async (req, res) => {
    applySecurityHeaders(res);
    try {
      if (!applyCors(res, req.headers.origin, opts.corsOrigins)) {
        throw new HttpError(403, 'CORS_FORBIDDEN');
      }
      if (req.method === 'OPTIONS') return send(res, { status: 204 });

      const ip = clientIp(
        req.socket.remoteAddress,
        req.headers['x-forwarded-for'],
        opts.trustProxyHops,
      );
      const rl = opts.rateLimiter.hit(`global:${ip}`);
      if (!rl.allowed) {
        throw new HttpError(429, 'TOO_MANY_REQUESTS', { 'Retry-After': String(rl.retryAfterSec) });
      }

      const url = new URL(req.url ?? '/', 'http://localhost');
      const match = opts.router.match(req.method ?? 'GET', url.pathname);
      if (match === null) throw new HttpError(404, 'NOT_FOUND');
      if (match === 'method-not-allowed') throw new HttpError(405, 'METHOD_NOT_ALLOWED');

      const body = await readJsonBody(req);
      const result = await match.handler({
        method: req.method ?? 'GET',
        path: url.pathname,
        params: match.params,
        query: url.searchParams,
        headers: req.headers,
        cookies: parseCookies(req.headers.cookie),
        ip,
        body,
      });
      send(res, result);
    } catch (err) {
      if (err instanceof HttpError) {
        // Body demasiado grande: cerrar la conexión para no seguir recibiendo datos.
        if (err.status === 413) res.setHeader('Connection', 'close');
        send(res, { status: err.status, body: { error: err.code }, headers: err.headers });
        if (err.status === 413) res.on('finish', () => req.destroy());
        return;
      }
      if (err instanceof DomainError) {
        return send(res, { status: STATUS_BY_CODE[err.code] ?? 400, body: domainErrorBody(err) });
      }
      opts.logger?.error('Unhandled error', err);
      send(res, { status: 500, body: { error: 'INTERNAL_ERROR' } });
    }
  });
}
