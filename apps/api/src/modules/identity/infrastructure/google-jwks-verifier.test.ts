import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { GoogleJwksVerifier } from './google-jwks-verifier.js';

let sign: (claims: Record<string, unknown>, aud?: string, iss?: string) => Promise<string>;
let verifier: GoogleJwksVerifier;

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
  verifier = new GoogleJwksVerifier(['web-client'], createLocalJWKSet({ keys: [jwk] }));
  sign = (claims, aud = 'web-client', iss = 'https://accounts.google.com') =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setSubject('g-123')
      .setIssuer(iss)
      .setAudience(aud)
      .setExpirationTime('5m')
      .sign(privateKey);
});

describe('GoogleJwksVerifier', () => {
  it('accepts a valid ID token', async () => {
    const t = await sign({ email: 'leo@gmail.com', email_verified: true, name: 'Leo' });
    await expect(verifier.verify(t)).resolves.toEqual({
      sub: 'g-123',
      email: 'leo@gmail.com',
      emailVerified: true,
      name: 'Leo',
    });
  });

  it('rejects other audiences and issuers', async () => {
    await expect(verifier.verify(await sign({ email: 'a@b.c' }, 'evil'))).rejects.toMatchObject({
      reason: 'INVALID_GOOGLE_TOKEN',
    });
    await expect(
      verifier.verify(await sign({ email: 'a@b.c' }, 'web-client', 'https://evil')),
    ).rejects.toThrow();
  });

  it('is disabled without client IDs', async () => {
    await expect(new GoogleJwksVerifier([]).verify('x')).rejects.toMatchObject({
      reason: 'GOOGLE_DISABLED',
    });
  });
});
