import { DEFAULT_LOCALE, type Locale, type WorkoutLogDto } from '@corner/shared';
import type { PrismaClient } from '@prisma/client';
import { ValidationError } from '../../../shared/domain/errors.js';
import type { WorkoutRepository } from '../application/workout-use-cases.js';
import type { WorkoutLogInput } from '../domain/workout.js';

export class PrismaWorkoutRepository implements WorkoutRepository {
  constructor(private readonly db: PrismaClient) {}

  async insertIfUnderLimit(userId: string, log: WorkoutLogInput, limit: number | null) {
    const slugs = [...new Set(log.entries.map((e) => e.exerciseSlug))];
    return this.db.$transaction(async (tx) => {
      // Bloquea la fila del usuario: serializa inserciones concurrentes para que el límite sea exacto.
      await tx.$queryRaw`SELECT id FROM User WHERE id = ${userId} FOR UPDATE`;
      const used = await tx.workoutLog.count({ where: { userId } });
      if (limit !== null && used >= limit) return { inserted: false as const, used };

      const exercises = await tx.exercise.findMany({
        where: { slug: { in: slugs } },
        select: { id: true, slug: true },
      });
      const ids = new Map(exercises.map((e) => [e.slug, e.id]));
      const unknown = slugs.filter((s) => !ids.has(s));
      if (unknown.length)
        throw new ValidationError('Ejercicio no reconocido', 'UNKNOWN_EXERCISE', {
          slugs: unknown,
        });

      if (log.sessionId) {
        const own = await tx.planSession.count({ where: { id: log.sessionId, plan: { userId } } });
        if (!own) throw new ValidationError('Sesión de plan no válida', 'INVALID_SESSION');
      }
      const created = await tx.workoutLog.create({
        data: {
          userId,
          sessionId: log.sessionId,
          performedAt: log.performedAt,
          durationMin: log.durationMin,
          rpe: log.rpe,
          feeling: log.feeling,
          notes: log.notes,
          entries: {
            create: log.entries.map((e) => ({
              exerciseId: ids.get(e.exerciseSlug) as string,
              setIndex: e.setIndex,
              reps: e.reps,
              weightKg: e.weightKg,
              seconds: e.seconds,
              rounds: e.rounds,
              rpe: e.rpe,
            })),
          },
        },
      });
      return { inserted: true as const, id: created.id, used: used + 1 };
    });
  }

  async list(userId: string, p: { page: number; pageSize: number }) {
    const [total, rows] = await this.db.$transaction([
      this.db.workoutLog.count({ where: { userId } }),
      this.db.workoutLog.findMany({
        where: { userId },
        orderBy: [{ performedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (p.page - 1) * p.pageSize,
        take: p.pageSize,
      }),
    ]);
    return {
      total,
      items: rows.map((w) => ({
        id: w.id,
        performedAt: w.performedAt.toISOString(),
        sessionId: w.sessionId,
        durationMin: w.durationMin,
        rpe: w.rpe,
        feeling: w.feeling,
        notes: w.notes,
      })),
    };
  }

  async get(userId: string, id: string, locale: Locale): Promise<WorkoutLogDto | null> {
    const w = await this.db.workoutLog.findFirst({
      where: { id, userId },
      include: {
        entries: {
          orderBy: { setIndex: 'asc' },
          include: {
            exercise: {
              select: {
                slug: true,
                translations: {
                  where: { locale: { in: [locale, DEFAULT_LOCALE] } },
                  select: { locale: true, name: true },
                },
              },
            },
          },
        },
      },
    });
    if (!w) return null;
    return {
      id: w.id,
      performedAt: w.performedAt.toISOString(),
      sessionId: w.sessionId,
      durationMin: w.durationMin,
      rpe: w.rpe,
      feeling: w.feeling,
      notes: w.notes,
      entries: w.entries.map((e) => {
        const t =
          e.exercise.translations.find((x) => x.locale === locale) ??
          e.exercise.translations.find((x) => x.locale === DEFAULT_LOCALE);
        return {
          exerciseSlug: e.exercise.slug,
          exerciseName: t?.name ?? e.exercise.slug,
          setIndex: e.setIndex,
          reps: e.reps,
          weightKg: e.weightKg === null ? null : Number(e.weightKg),
          seconds: e.seconds,
          rounds: e.rounds,
          rpe: e.rpe,
        };
      }),
    };
  }

  async delete(userId: string, id: string) {
    const { count } = await this.db.workoutLog.deleteMany({ where: { id, userId } });
    return count === 1;
  }

  async deleteAll(userId: string) {
    const { count } = await this.db.workoutLog.deleteMany({ where: { userId } });
    return count;
  }
}
