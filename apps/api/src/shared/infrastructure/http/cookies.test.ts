import { describe, expect, it } from 'vitest';
import { parseCookies, serializeCookie } from './cookies.js';

describe('cookies', () => {
  it('parses a cookie header', () => {
    expect(parseCookies('a=1; corner_rt=abc%3D; bad')).toEqual({ a: '1', corner_rt: 'abc=' });
  });

  it('returns empty object without header', () => {
    expect(parseCookies(undefined)).toEqual({});
  });

  it('serializes with security attributes', () => {
    const c = serializeCookie('rt', 'x y', {
      maxAgeSec: 60,
      path: '/api/v1/auth',
      secure: true,
      httpOnly: true,
      sameSite: 'Strict',
    });
    expect(c).toBe('rt=x%20y; Max-Age=60; Path=/api/v1/auth; SameSite=Strict; HttpOnly; Secure');
  });
});
