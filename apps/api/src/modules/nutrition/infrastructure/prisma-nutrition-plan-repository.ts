import {
  DEFAULT_LOCALE,
  type Locale,
  type NutritionGuidelineDto,
  type NutritionPlanDto,
  type TrainingGoal,
} from '@corner/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  NutritionPlanDraft,
  NutritionPlanRepository,
} from '../application/nutrition-use-cases.js';

const pick = <T extends { locale: string }>(rows: T[], locale: Locale) =>
  rows.find((r) => r.locale === locale) ?? rows.find((r) => r.locale === DEFAULT_LOCALE);

export class PrismaNutritionPlanRepository implements NutritionPlanRepository {
  constructor(private readonly db: PrismaClient) {}

  async replaceActive(userId: string, d: NutritionPlanDraft): Promise<string> {
    return this.db.$transaction(async (tx) => {
      // Serializa generaciones concurrentes del mismo usuario.
      await tx.$queryRaw`SELECT id FROM User WHERE id = ${userId} FOR UPDATE`;
      const menu = await tx.menuTemplate.findFirst({
        where: { goal: d.goal },
        orderBy: { code: 'asc' },
      });
      // Solo suplementos que existen en la wiki (el contenido puede no estar cargado aún).
      const articles = await tx.wikiArticle.findMany({
        where: {
          slug: { in: d.supplements.map((s) => s.slug) },
          isPublished: true,
          supplement: { isNot: null },
        },
        select: { slug: true, supplement: { select: { id: true } } },
      });
      const supId = new Map(articles.map((a) => [a.slug, a.supplement?.id]));
      await tx.nutritionPlan.updateMany({
        where: { userId, status: 'ACTIVE' },
        data: { status: 'ARCHIVED' },
      });
      const plan = await tx.nutritionPlan.create({
        data: {
          userId,
          kind: d.kind,
          kcalTarget: d.targets?.kcal ?? null,
          proteinG: d.targets?.proteinG ?? null,
          carbsG: d.targets?.carbsG ?? null,
          fatG: d.targets?.fatG ?? null,
          menuTemplateId: menu?.id ?? null,
          guidelines: { goal: d.goal, items: d.guidelines } as unknown as Prisma.InputJsonObject,
          supplements: {
            create: d.supplements
              .filter((s) => supId.get(s.slug))
              .map((s) => ({ supplementId: supId.get(s.slug) as string, reason: s.reason })),
          },
        },
      });
      return plan.id;
    });
  }

  async findActive(userId: string, locale: Locale): Promise<NutritionPlanDto | null> {
    const p = await this.db.nutritionPlan.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      include: {
        menuTemplate: {
          include: { translations: { where: { locale: { in: [locale, DEFAULT_LOCALE] } } } },
        },
        supplements: {
          include: {
            supplement: {
              include: {
                article: {
                  select: {
                    slug: true,
                    translations: {
                      where: { locale: { in: [locale, DEFAULT_LOCALE] } },
                      select: { locale: true, title: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!p) return null;
    const g = (p.guidelines ?? {}) as { goal?: TrainingGoal; items?: NutritionGuidelineDto[] };
    const menuT = p.menuTemplate ? pick(p.menuTemplate.translations, locale) : undefined;
    const hasTargets =
      p.kcalTarget !== null && p.proteinG !== null && p.carbsG !== null && p.fatG !== null;
    return {
      id: p.id,
      kind: p.kind,
      goal: g.goal ?? 'GENERAL_FITNESS',
      targets: hasTargets
        ? {
            kcal: p.kcalTarget as number,
            proteinG: p.proteinG as number,
            carbsG: p.carbsG as number,
            fatG: p.fatG as number,
          }
        : null,
      guidelines: g.items ?? [],
      menu: menuT
        ? { title: menuT.title, content: menuT.content as Record<string, string[]> }
        : null,
      supplements: p.supplements.map((s) => ({
        slug: s.supplement.article.slug,
        title: pick(s.supplement.article.translations, locale)?.title ?? s.supplement.article.slug,
        reason: s.reason,
      })),
      requiresHealthDisclaimer: true,
      createdAt: p.createdAt.toISOString(),
    };
  }
}
