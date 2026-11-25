import { describe, expect, it } from 'vitest';
import { Router } from './router.js';

describe('Router', () => {
  const h = () => ({ status: 200 });

  it('matches static and param routes', () => {
    const r = new Router().get('/api/v1/exercises/:id', h);
    const m = r.match('GET', '/api/v1/exercises/abc');
    expect(m).not.toBeNull();
    expect(m !== 'method-not-allowed' && m?.params).toEqual({ id: 'abc' });
  });

  it('returns method-not-allowed when path exists with another method', () => {
    const r = new Router().get('/x', h);
    expect(r.match('POST', '/x')).toBe('method-not-allowed');
  });

  it('returns null for unknown path', () => {
    expect(new Router().get('/x', h).match('GET', '/y')).toBeNull();
  });
});
