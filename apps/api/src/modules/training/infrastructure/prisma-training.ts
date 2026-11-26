import {
  DEFAULT_LOCALE,
  type Difficulty,
  type EquipmentType,
  type ExerciseCategory,
  type Locale,
  type MeasureType,
  type Muscle,
  type SessionBlock,
  type SessionFocus,
  type TrainingGoal,
  type TrainingPlanDto,
} from '@corner/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { ExerciseCandidateReader, TrainingPlanRepository } from '../application/ports.js';
import type { ExerciseCandidate } from '../domain/plan-generator.js';

const strings = (v: Prisma.JsonValue | null): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

export class PrismaExerciseCandidateReader implements ExerciseCandidateReader {
  constructor(private readonly db: PrismaClient) {}

  async listCandidates(): Promise<ExerciseCandidate[]> {
    const rows = await this.db.exercise.findMany({
      where: {
        isActive: true,
        OR: [
          { category: { not: 'SPORT_DRILL' } },
          { sports: { some: { sport: { isEnabled: true } } } },
        ],
      },
      include: {
        equipment: { include: { equipment: { select: { code: true } } } },
        sports: {
          where: { sport: { isEnabled: true } },
          include: { sport: { select: { code: true } } },
        },
      },
    });
    return rows.map((e) => ({
      slug: e.slug,
      category: e.category as ExerciseCategory,
      difficulty: e.difficulty as Difficulty,
      measureType: e.measureType as MeasureType,
      primaryMuscles: strings(e.primaryMuscles) as Muscle[],
      equipment: e.equipment.map((x) => x.equipment.code as EquipmentType),
      sports: e.sports.map((s) => s.sport.code),
      defaults: {
        sets: e.defaultSets,
        reps: e.defaultReps,
        seconds: e.defaultSeconds,
        restSec: e.defaultRestSec,
      },
    }));
  }
}

export class PrismaTrainingPlanRepository implements TrainingPlanRepository {
  constructor(private readonly db: PrismaClient) {}

  async replaceActive(
    userId: string,
    plan: Parameters<TrainingPlanRepository['replaceActive']>[1],
  ): Promise<string> {
    const slugs = [...new Set(plan.sessions.flatMap((s) => s.exercises.map((e) => e.slug)))];
    return this.db.$transaction(async (tx) => {
      // Serializa generaciones concurrentes del mismo usuario (evita interbloqueos y dos planes activos).
      await tx.$queryRaw`SELECT id FROM User WHERE id = ${userId} FOR UPDATE`;
      const ids = new Map(
        (
          await tx.exercise.findMany({
            where: { slug: { in: slugs } },
            select: { id: true, slug: true },
          })
        ).map((e) => [e.slug, e.id]),
      );
      await tx.trainingPlan.updateMany({
        where: { userId, status: 'ACTIVE' },
        data: { status: 'ARCHIVED' },
      });
      const created = await tx.trainingPlan.create({
        data: {
          userId,
          source: plan.source,
          name: plan.name,
          generatorVersion: plan.generatorVersion,
          params: { ...plan.params, goal: plan.goal } as Prisma.InputJsonObject,
          aiRationale: plan.aiRationale,
          startsOn: plan.startsOn,
          sessions: {
            create: plan.sessions.map((s, i) => ({
              dayOfWeek: s.dayOfWeek,
              orderIndex: i,
              title: s.focus,
              focus: s.focus,
              exercises: {
                create: s.exercises
                  .filter((e) => ids.has(e.slug))
                  .map((e, j) => ({
                    exerciseId: ids.get(e.slug) as string,
                    orderIndex: j,
                    block: e.block,
                    sets: e.sets,
                    reps: e.reps,
                    seconds: e.seconds,
                    rounds: e.rounds,
                    restSec: e.restSec,
                  })),
              },
            })),
          },
        },
      });
      return created.id;
    });
  }

  async findActive(userId: string, locale: Locale): Promise<TrainingPlanDto | null> {
    const p = await this.db.trainingPlan.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      include: {
        sessions: {
          orderBy: { orderIndex: 'asc' },
          include: {
            exercises: {
              orderBy: { orderIndex: 'asc' },
              include: {
                exercise: {
                  select: {
                    slug: true,
                    category: true,
                    measureType: true,
                    translations: {
                      where: { locale: { in: [locale, DEFAULT_LOCALE] } },
                      select: { locale: true, name: true },
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
    const params = (p.params ?? {}) as { goal?: TrainingGoal };
    return {
      id: p.id,
      source: p.source,
      name: p.name,
      goal: params.goal ?? 'GENERAL_FITNESS',
      startsOn: p.startsOn.toISOString().slice(0, 10),
      createdAt: p.createdAt.toISOString(),
      sessions: p.sessions.map((s) => ({
        id: s.id,
        dayOfWeek: s.dayOfWeek,
        focus: s.focus as SessionFocus,
        exercises: s.exercises.map((x) => {
          const t =
            x.exercise.translations.find((tr) => tr.locale === locale) ??
            x.exercise.translations.find((tr) => tr.locale === DEFAULT_LOCALE);
          return {
            slug: x.exercise.slug,
            name: t?.name ?? x.exercise.slug,
            category: x.exercise.category as ExerciseCategory,
            measureType: x.exercise.measureType as MeasureType,
            block: x.block as SessionBlock,
            sets: x.sets,
            reps: x.reps,
            seconds: x.seconds,
            rounds: x.rounds,
            restSec: x.restSec,
          };
        }),
      })),
    };
  }
}
