import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { JoseAccessTokenService } from './jose-access-token-service.js';

const secret = 'x'.repeat(40);

describe('JoseAccessTokenService', () => {
  it('issues and verifies a token', async () => {
    const svc = new JoseAccessTokenService(secret);
    const { token, expiresIn } = await svc.issue('user-1');
    expect(expiresIn).toBe(900);
    await expect(svc.verify(token)).resolves.toEqual({ userId: 'user-1' });
  });

  it('rejects tokens signed with another key', async () => {
    const other = await new JoseAccessTokenService('y'.repeat(40)).issue('user-1');
    await expect(new JoseAccessTokenService(secret).verify(other.token)).rejects.toMatchObject({
      reason: 'INVALID_ACCESS_TOKEN',
    });
  });

  it('rejects expired tokens', async () => {
    const svc = new JoseAccessTokenService(secret, -10);
    const { token } = await svc.issue('u');
    await expect(svc.verify(token)).rejects.toMatchObject({ reason: 'INVALID_ACCESS_TOKEN' });
  });

  it('rejects tokens with wrong audience', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('u')
      .setIssuer('corner-api')
      .setAudience('other')
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode(secret));
    await expect(new JoseAccessTokenService(secret).verify(token)).rejects.toThrow();
  });
});
