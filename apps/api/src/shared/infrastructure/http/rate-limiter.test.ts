import { describe, expect, it } from 'vitest';
import { InMemoryRateLimiter } from './rate-limiter.js';

describe('InMemoryRateLimiter', () => {
  it('blocks after max hits within window and resets after it', () => {
    let t = 0;
    const rl = new InMemoryRateLimiter(2, 1000, () => t);
    expect(rl.hit('ip').allowed).toBe(true);
    expect(rl.hit('ip').allowed).toBe(true);
    expect(rl.hit('ip')).toEqual({ allowed: false, retryAfterSec: 1 });
    t = 1000;
    expect(rl.hit('ip').allowed).toBe(true);
  });

  it('evicts expired buckets', () => {
    let t = 0;
    const rl = new InMemoryRateLimiter(5, 1000, () => t);
    for (let i = 0; i < 50; i++) rl.hit(`ip-${i}`);
    expect(rl.size).toBe(50);
    t = 2000;
    rl.hit('fresh');
    expect(rl.size).toBe(1);
  });

  it('caps the number of tracked keys', () => {
    const rl = new InMemoryRateLimiter(5, 60_000, () => 0, 10);
    for (let i = 0; i < 25; i++) rl.hit(`ip-${i}`);
    expect(rl.size).toBe(10);
  });
});
