import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

const base = {
  DATABASE_URL: 'mysql://u:p@127.0.0.1:3306/corner',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
};

describe('loadEnv', () => {
  it('parses CORS origins and Google client IDs lists', () => {
    const env = loadEnv({ ...base, CORS_ORIGINS: 'http://a, http://b', GOOGLE_CLIENT_ID: 'w,i' });
    expect(env.CORS_ORIGINS).toEqual(['http://a', 'http://b']);
    expect(env.GOOGLE_CLIENT_ID).toEqual(['w', 'i']);
  });

  it('rejects short JWT secrets', () => {
    expect(() => loadEnv({ ...base, JWT_ACCESS_SECRET: 'short' })).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('secure cookies by default; only explicit false disables them', () => {
    expect(loadEnv({ ...base }).COOKIE_SECURE).toBe(true);
    expect(loadEnv({ ...base, NODE_ENV: 'development' }).COOKIE_SECURE).toBe(true);
    expect(loadEnv({ ...base, COOKIE_SECURE: 'false' }).COOKIE_SECURE).toBe(false);
  });

  it('parses trusted proxy hops', () => {
    expect(loadEnv({ ...base }).TRUST_PROXY_HOPS).toBe(0);
    expect(loadEnv({ ...base, TRUST_PROXY_HOPS: '1' }).TRUST_PROXY_HOPS).toBe(1);
    expect(() => loadEnv({ ...base, TRUST_PROXY_HOPS: '-1' })).toThrow();
  });
});
