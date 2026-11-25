import { z } from 'zod';

const list = (s: string) =>
  s
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

const bool = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true'));

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  CORS_ORIGINS: z.string().default('http://localhost:4200').transform(list),
  JWT_ACCESS_SECRET: z.string().min(32),
  /** Uno o varios client IDs (web, iOS, Android) separados por comas. */
  GOOGLE_CLIENT_ID: z.string().default('').transform(list),
  /** Por defecto true. Solo false para desarrollo local por HTTP. */
  COOKIE_SECURE: bool,
  /** Número de proxies inversos propios delante de la API. 0 = ignorar X-Forwarded-For. */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
});

type RawEnv = z.infer<typeof EnvSchema>;
export type Env = Omit<RawEnv, 'COOKIE_SECURE'> & { COOKIE_SECURE: boolean };

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Configuración inválida: ${issues}`);
  }
  const e = parsed.data;
  // Seguro por defecto: desactivarlo exige COOKIE_SECURE=false explícito.
  return { ...e, COOKIE_SECURE: e.COOKIE_SECURE ?? true };
}
