import { DEFAULT_LOCALE, Locales, type Locale } from '@corner/shared';
import type { HttpRequest } from './types.js';

const isLocale = (v: string): v is Locale => (Locales as readonly string[]).includes(v);

/** `?lang=` tiene prioridad; si no, Accept-Language (por calidad); por defecto español. */
export function resolveLocale(req: Pick<HttpRequest, 'query' | 'headers'>): Locale {
  const q = req.query.get('lang')?.toLowerCase();
  if (q && isLocale(q)) return q;
  const header = req.headers['accept-language'];
  if (typeof header === 'string') {
    const ranked = header
      .split(',')
      .map((part) => {
        const [tag = '', ...params] = part.trim().split(';');
        const qv = params.find((p) => p.trim().startsWith('q='));
        return {
          lang: tag.toLowerCase().split('-')[0] ?? '',
          q: qv ? Number(qv.split('=')[1]) : 1,
        };
      })
      .filter((x) => x.lang && Number.isFinite(x.q) && x.q > 0)
      .sort((a, b) => b.q - a.q);
    const hit = ranked.find((x) => isLocale(x.lang));
    if (hit && isLocale(hit.lang)) return hit.lang;
  }
  return DEFAULT_LOCALE;
}
