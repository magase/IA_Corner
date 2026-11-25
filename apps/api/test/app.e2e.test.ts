import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ORIGIN, startTestApp } from './helpers/build-test-app.js';

describe('API transport (e2e)', () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;
  beforeAll(async () => {
    app = await startTestApp();
  });
  afterAll(() => app.close());

  it('GET /api/v1/health returns ok with security headers', async () => {
    const res = await fetch(`${app.base}/api/v1/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', database: 'up' });
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
  });

  it('applies CORS only to allowed origins', async () => {
    const ok = await fetch(`${app.base}/api/v1/health`, { headers: { Origin: ORIGIN } });
    expect(ok.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    const evil = await fetch(`${app.base}/api/v1/health`, {
      headers: { Origin: 'http://evil.test' },
    });
    expect(evil.status).toBe(403);
  });

  it('returns 404 for unknown routes and 405 for wrong method', async () => {
    expect((await fetch(`${app.base}/nope`)).status).toBe(404);
    expect((await fetch(`${app.base}/api/v1/health`, { method: 'POST' })).status).toBe(405);
  });

  it('rejects non-JSON bodies, invalid JSON and oversized payloads', async () => {
    const url = `${app.base}/api/v1/auth/login`;
    expect(
      (await fetch(url, { method: 'POST', body: 'x=1', headers: { 'Content-Type': 'text/plain' } }))
        .status,
    ).toBe(415);
    expect(
      (
        await fetch(url, {
          method: 'POST',
          body: '{bad',
          headers: { 'Content-Type': 'application/json' },
        })
      ).status,
    ).toBe(400);
    const big = JSON.stringify({ email: 'a'.repeat(200 * 1024) });
    expect(
      (
        await fetch(url, {
          method: 'POST',
          body: big,
          headers: { 'Content-Type': 'application/json' },
        })
      ).status,
    ).toBe(413);
  });
});
