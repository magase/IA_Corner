import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { ExerciseSeed, findForbiddenContent, MenuSeed, WikiSeed } from './schema.js';

export const EXERCISE_FILES = [
  'exercises.strength-plyometrics.json',
  'exercises.mobility-flexibility.json',
  'drills.striking.json',
] as const;
export const WIKI_FILES = [
  'wiki.nutrition.json',
  'wiki.supplements.json',
  'wiki.training.json',
] as const;

const dir = fileURLToPath(new URL('.', import.meta.url));

function parseFile<S extends z.ZodType>(file: string, item: S): z.output<S>[] {
  const raw: unknown = JSON.parse(readFileSync(`${dir}${file}`, 'utf8'));
  const res = z.array(item).safeParse(raw);
  if (!res.success) {
    const msg = res.error.issues
      .slice(0, 20)
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`${file} no es válido:\n${msg}`);
  }
  const forbidden = findForbiddenContent(raw);
  if (forbidden.length)
    throw new Error(`${file} contiene contenido excluido:\n  ${forbidden.join('\n  ')}`);
  return res.data;
}

export const loadExercises = (file: string) => parseFile(file, ExerciseSeed);
export const loadWiki = (file: string) => parseFile(file, WikiSeed);
export const MENU_FILE = 'menus.json';
export const loadMenus = () => parseFile(MENU_FILE, MenuSeed);
