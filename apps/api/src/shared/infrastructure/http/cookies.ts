export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    const name = part.slice(0, i).trim();
    const raw = part.slice(i + 1).trim();
    try {
      out[name] = decodeURIComponent(raw);
    } catch {
      out[name] = raw;
    }
  }
  return out;
}

export interface CookieOptions {
  maxAgeSec: number;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: 'Strict' | 'Lax';
}

export function serializeCookie(name: string, value: string, o: CookieOptions): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Max-Age=${o.maxAgeSec}`,
    `Path=${o.path}`,
    `SameSite=${o.sameSite}`,
  ];
  if (o.httpOnly) parts.push('HttpOnly');
  if (o.secure) parts.push('Secure');
  return parts.join('; ');
}
