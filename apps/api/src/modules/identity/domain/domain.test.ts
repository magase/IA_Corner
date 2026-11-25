import { describe, expect, it } from 'vitest';
import { ageOn, assertAdult, parseBirthDate } from './age.js';
import { normalizeEmail } from './email.js';
import { assertPasswordPolicy } from './password-policy.js';
import { createUser, toPublicUser } from './user.js';

const today = new Date('2026-11-25T10:00:00Z');

describe('email', () => {
  it('normalizes case and whitespace', () => {
    expect(normalizeEmail('  Ana@Corner.APP ')).toBe('ana@corner.app');
  });
  it.each(['', 'no-at', 'a@b', 'a b@c.com'])('rejects %j', (e) => {
    expect(() => normalizeEmail(e)).toThrow(expect.objectContaining({ reason: 'INVALID_EMAIL' }));
  });
});

describe('password policy', () => {
  it('accepts a long password with letters and digits', () => {
    expect(() => assertPasswordPolicy('golpe-recto-2026', 'ana@corner.app')).not.toThrow();
  });
  it.each([
    ['short1', 'too short'],
    ['soloLetrasLargas', 'no digits'],
    ['12345678901', 'no letters'],
    ['marcosanchez99', 'contains email'],
  ])('rejects %s (%s)', (pw) => {
    expect(() => assertPasswordPolicy(pw, 'marcosanchez@corner.app')).toThrow(
      expect.objectContaining({ reason: 'WEAK_PASSWORD' }),
    );
  });
});

describe('age', () => {
  it('parses strict dates and rejects impossible ones', () => {
    expect(parseBirthDate('2000-02-29').toISOString()).toBe('2000-02-29T00:00:00.000Z');
    expect(() => parseBirthDate('2001-02-29')).toThrow(
      expect.objectContaining({ reason: 'INVALID_BIRTHDATE' }),
    );
    expect(() => parseBirthDate('25/11/2000')).toThrow();
  });

  it('computes age respecting the birthday', () => {
    expect(ageOn(parseBirthDate('2008-11-25'), today)).toBe(18);
    expect(ageOn(parseBirthDate('2008-11-26'), today)).toBe(17);
  });

  it('requires 18 years', () => {
    expect(() => assertAdult(parseBirthDate('2008-11-25'), today)).not.toThrow();
    expect(() => assertAdult(parseBirthDate('2008-11-26'), today)).toThrow(
      expect.objectContaining({ reason: 'UNDERAGE' }),
    );
  });

  it('rejects future and absurd dates', () => {
    expect(() => assertAdult(parseBirthDate('2030-01-01'), today)).toThrow(
      expect.objectContaining({ reason: 'INVALID_BIRTHDATE' }),
    );
    expect(() => assertAdult(parseBirthDate('1890-01-01'), today)).toThrow(
      expect.objectContaining({ reason: 'INVALID_BIRTHDATE' }),
    );
  });
});

describe('user', () => {
  it('creates a user without health consent and exposes a public view', () => {
    const u = createUser({
      id: 'u1',
      email: 'ana@corner.app',
      displayName: '  Ana   López ',
      locale: 'es',
      birthDate: parseBirthDate('1995-05-10'),
      passwordHash: 'h',
      emailVerified: false,
      now: today,
    });
    expect(u.displayName).toBe('Ana López');
    const pub = toPublicUser(u);
    expect(pub).toEqual({
      id: 'u1',
      email: 'ana@corner.app',
      displayName: 'Ana López',
      locale: 'es',
      birthDate: '1995-05-10',
      hasHealthConsent: false,
      createdAt: today.toISOString(),
    });
    expect(pub).not.toHaveProperty('passwordHash');
  });
});
