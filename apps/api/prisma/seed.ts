/* eslint-disable no-console */
import type { SportCategory } from '@prisma/client';
import { createPrismaClient } from '../src/shared/infrastructure/persistence/prisma-client.js';
import { EQUIPMENT, GRAPPLING, STRIKING } from './seed-data/catalog.js';

if (!process.env['DATABASE_URL']) throw new Error('DATABASE_URL no definida');
const prisma = createPrismaClient(process.env['DATABASE_URL']);
type T = { es: string; en: string };

async function upsertSport(
  code: string,
  category: SportCategory,
  isEnabled: boolean,
  name: T,
  desc: T,
) {
  const sport = await prisma.sport.upsert({
    where: { code },
    create: { code, category, isEnabled },
    update: { category, isEnabled },
  });
  for (const locale of ['es', 'en'] as const) {
    await prisma.sportTranslation.upsert({
      where: { sportId_locale: { sportId: sport.id, locale } },
      create: { sportId: sport.id, locale, name: name[locale], description: desc[locale] },
      update: { name: name[locale], description: desc[locale] },
    });
  }
}

async function main() {
  for (const [code, s] of Object.entries(STRIKING)) {
    await upsertSport(code, 'STRIKING', true, s.name, s.description);
  }
  for (const [code, name] of Object.entries(GRAPPLING)) {
    await upsertSport(code, 'GRAPPLING', false, name, { es: '', en: '' });
  }
  for (const [code, name] of Object.entries(EQUIPMENT)) {
    const eq = await prisma.equipment.upsert({ where: { code }, create: { code }, update: {} });
    for (const locale of ['es', 'en'] as const) {
      await prisma.equipmentTranslation.upsert({
        where: { equipmentId_locale: { equipmentId: eq.id, locale } },
        create: { equipmentId: eq.id, locale, name: name[locale] },
        update: { name: name[locale] },
      });
    }
  }
  console.log(
    `Seed OK: ${Object.keys(STRIKING).length} deportes de striking, ${Object.keys(GRAPPLING).length} de grappling (desactivados), ${Object.keys(EQUIPMENT).length} tipos de material.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
