import { DEFAULT_LOCALE, Locales } from '@corner/shared';
import { z } from 'zod';

const locale = z.enum(Locales).default(DEFAULT_LOCALE);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD');

export const RegisterSchema = z
  .object({
    email: z.string().max(254),
    password: z.string().max(128),
    displayName: z.string().max(200),
    birthDate: date,
    locale,
    acceptTerms: z.boolean(),
  })
  .strict();

export const LoginSchema = z
  .object({ email: z.string().max(254), password: z.string().max(128) })
  .strict();

export const GoogleLoginSchema = z
  .object({
    idToken: z.string().min(1).max(4096),
    birthDate: date.nullable().default(null),
    displayName: z.string().max(200).nullable().default(null),
    acceptTerms: z.boolean().default(false),
    locale,
  })
  .strict();

export const ConsentSchema = z.object({ accepted: z.boolean() }).strict();

export const DeleteAccountSchema = z
  .object({
    password: z.string().max(128).nullable().default(null),
    googleIdToken: z.string().max(4096).nullable().default(null),
  })
  .strict();
