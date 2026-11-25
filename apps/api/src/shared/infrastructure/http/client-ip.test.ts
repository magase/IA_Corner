import { describe, expect, it } from 'vitest';
import { clientIp } from './server.js';

describe('clientIp', () => {
  it('ignores X-Forwarded-For when no proxy is trusted', () => {
    expect(clientIp('10.0.0.1', '1.2.3.4', 0)).toBe('10.0.0.1');
  });

  it('takes the entry added by our proxy (rightmost), not the spoofable leftmost', () => {
    expect(clientIp('10.0.0.1', 'spoofed, 203.0.113.7', 1)).toBe('203.0.113.7');
    expect(clientIp('10.0.0.1', 'spoofed, 203.0.113.7, 10.0.0.2', 2)).toBe('203.0.113.7');
  });

  it('falls back to the socket address if the chain is shorter than the hops', () => {
    expect(clientIp('10.0.0.1', '203.0.113.7', 2)).toBe('10.0.0.1');
  });
});
