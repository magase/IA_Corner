import { describe, expect, it } from 'vitest';
import { GetHealth } from './get-health.js';

describe('GetHealth', () => {
  it('reports ok when database is up', async () => {
    const uc = new GetHealth({ isDatabaseUp: async () => true });
    expect(await uc.execute()).toEqual({ status: 'ok', database: 'up' });
  });

  it('reports degraded when database check throws', async () => {
    const uc = new GetHealth({
      isDatabaseUp: async () => {
        throw new Error('boom');
      },
    });
    expect(await uc.execute()).toEqual({ status: 'degraded', database: 'down' });
  });
});
