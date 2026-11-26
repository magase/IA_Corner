import { describe, expect, it } from 'vitest';
import { resolveLocale } from './locale.js';

const req = (lang: string | null, accept?: string) => ({
  query: new URLSearchParams(lang ? { lang } : {}),
  headers: accept ? { 'accept-language': accept } : {},
});

describe('resolveLocale', () => {
  it('prefers ?lang', () => expect(resolveLocale(req('en', 'es-ES'))).toBe('en'));
  it('uses Accept-Language by quality', () => {
    expect(resolveLocale(req(null, 'fr-FR,en;q=0.8,es;q=0.5'))).toBe('en');
    expect(resolveLocale(req(null, 'en;q=0.3, es-ES;q=0.9'))).toBe('es');
  });
  it('falls back to Spanish', () => {
    expect(resolveLocale(req('de', 'fr'))).toBe('es');
    expect(resolveLocale(req(null))).toBe('es');
  });
});
