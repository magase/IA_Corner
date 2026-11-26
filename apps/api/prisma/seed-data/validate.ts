/* eslint-disable no-console */
// Uso: npx tsx prisma/seed-data/validate.ts <fichero.json>
import { EXERCISE_FILES, loadExercises, loadMenus, loadWiki } from './load.js';

const file = process.argv[2];
if (!file) {
  console.error('Uso: validate.ts <fichero.json>');
  process.exit(2);
}
try {
  const isExercise = (EXERCISE_FILES as readonly string[]).includes(file);
  const items: { slug?: string; code?: string; category?: string; goal?: string }[] =
    file === 'menus.json' ? loadMenus() : isExercise ? loadExercises(file) : loadWiki(file);
  const slugs = items.map((i) => i.slug ?? i.code);
  const dup = slugs.filter((s, i) => slugs.indexOf(s) !== i);
  if (dup.length) throw new Error(`slugs duplicados: ${[...new Set(dup)].join(', ')}`);
  const counts: Record<string, number> = {};
  for (const i of items) {
    const k = i.category ?? i.goal ?? '?';
    counts[k] = (counts[k] ?? 0) + 1;
  }
  console.log(`OK ${file}: ${items.length} elementos`, counts);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
