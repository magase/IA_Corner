import type { Locale, NutritionPlanDto, TrainingPlanDto, WorkoutLogDto } from '@corner/shared';
import type {
  NutritionPlanDraft,
  NutritionPlanRepository,
} from '../../src/modules/nutrition/application/nutrition-use-cases.js';
import type {
  ExerciseCandidateReader,
  TrainingPlanRepository,
} from '../../src/modules/training/application/ports.js';
import type { ExerciseCandidate } from '../../src/modules/training/domain/plan-generator.js';
import type { WorkoutRepository } from '../../src/modules/workouts/application/workout-use-cases.js';
import type { WorkoutLogInput } from '../../src/modules/workouts/domain/workout.js';
import type { AthleteContextReader } from '../../src/shared/application/athlete-context.js';
import { ValidationError } from '../../src/shared/domain/errors.js';
import { CANDIDATES } from './candidates.js';
import type { InMemoryProfiles, InMemoryUsers } from './index.js';

export class InMemoryAthletes implements AthleteContextReader {
  constructor(
    private readonly users: InMemoryUsers,
    private readonly profiles: InMemoryProfiles,
  ) {}
  async forUser(userId: string) {
    const u = this.users.users.get(userId);
    if (!u) return null;
    const consent = u.healthDataConsentAt !== null;
    return {
      hasHealthConsent: consent,
      birthDate: u.birthDate,
      profile: consent ? (this.profiles.data.get(userId) ?? null) : null,
    };
  }
}

export class InMemoryCandidates implements ExerciseCandidateReader {
  constructor(public candidates: ExerciseCandidate[] = CANDIDATES) {}
  async listCandidates() {
    return this.candidates;
  }
}

let seq = 0;
const uid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

export class InMemoryTrainingPlans implements TrainingPlanRepository {
  readonly plans: (TrainingPlanDto & { userId: string; active: boolean })[] = [];
  async replaceActive(userId: string, p: Parameters<TrainingPlanRepository['replaceActive']>[1]) {
    this.plans.filter((x) => x.userId === userId).forEach((x) => (x.active = false));
    const id = uid();
    this.plans.push({
      id,
      userId,
      active: true,
      source: p.source,
      name: p.name,
      goal: p.goal,
      startsOn: p.startsOn.toISOString().slice(0, 10),
      createdAt: new Date(0).toISOString(),
      sessions: p.sessions.map((s) => ({
        id: uid(),
        dayOfWeek: s.dayOfWeek,
        focus: s.focus,
        exercises: s.exercises.map((e) => ({
          ...e,
          name: e.slug,
          category: CANDIDATES.find((c) => c.slug === e.slug)?.category ?? 'STRENGTH',
          measureType: CANDIDATES.find((c) => c.slug === e.slug)?.measureType ?? 'REPS',
        })),
      })),
    });
    return id;
  }
  async findActive(userId: string, _locale: Locale) {
    const p = this.plans.find((x) => x.userId === userId && x.active);
    if (!p) return null;
    const { userId: _u, active: _a, ...dto } = p;
    return dto;
  }
}

export class InMemoryNutritionPlans implements NutritionPlanRepository {
  readonly plans: { userId: string; active: boolean; dto: NutritionPlanDto }[] = [];
  async replaceActive(userId: string, d: NutritionPlanDraft) {
    this.plans.filter((x) => x.userId === userId).forEach((x) => (x.active = false));
    const id = uid();
    this.plans.push({
      userId,
      active: true,
      dto: {
        id,
        kind: d.kind,
        goal: d.goal,
        targets: d.targets,
        guidelines: d.guidelines,
        menu: null,
        supplements: d.supplements.map((s) => ({ slug: s.slug, title: s.slug, reason: s.reason })),
        requiresHealthDisclaimer: true,
        createdAt: new Date(0).toISOString(),
      },
    });
    return id;
  }
  async findActive(userId: string) {
    return this.plans.find((x) => x.userId === userId && x.active)?.dto ?? null;
  }
}

/** Fake con la misma semántica que el adaptador Prisma (límite atómico, slugs válidos, propiedad). */
export class InMemoryWorkouts implements WorkoutRepository {
  readonly logs: (WorkoutLogDto & { userId: string })[] = [];
  constructor(private readonly knownSlugs: Set<string> = new Set(CANDIDATES.map((c) => c.slug))) {}

  async insertIfUnderLimit(userId: string, log: WorkoutLogInput, limit: number | null) {
    const used = this.logs.filter((l) => l.userId === userId).length;
    if (limit !== null && used >= limit) return { inserted: false as const, used };
    const unknown = log.entries.map((e) => e.exerciseSlug).filter((s) => !this.knownSlugs.has(s));
    if (unknown.length)
      throw new ValidationError('Ejercicio no reconocido', 'UNKNOWN_EXERCISE', { slugs: unknown });
    const id = uid();
    this.logs.push({
      id,
      userId,
      performedAt: log.performedAt.toISOString(),
      sessionId: log.sessionId,
      durationMin: log.durationMin,
      rpe: log.rpe,
      feeling: log.feeling,
      notes: log.notes,
      entries: log.entries.map((e) => ({ ...e, exerciseName: e.exerciseSlug })),
    });
    return { inserted: true as const, id, used: used + 1 };
  }
  async list(userId: string, p: { page: number; pageSize: number }) {
    const mine = this.logs
      .filter((l) => l.userId === userId)
      .sort((a, b) => b.performedAt.localeCompare(a.performedAt));
    const items = mine
      .slice((p.page - 1) * p.pageSize, p.page * p.pageSize)
      .map(({ entries: _e, userId: _u, ...r }) => r);
    return { items, total: mine.length };
  }
  async get(userId: string, id: string) {
    const l = this.logs.find((x) => x.id === id && x.userId === userId);
    if (!l) return null;
    const { userId: _u, ...dto } = l;
    return dto;
  }
  async delete(userId: string, id: string) {
    const i = this.logs.findIndex((x) => x.id === id && x.userId === userId);
    if (i < 0) return false;
    this.logs.splice(i, 1);
    return true;
  }
  async deleteAll(userId: string) {
    const before = this.logs.length;
    for (let i = this.logs.length - 1; i >= 0; i--)
      if (this.logs[i]!.userId === userId) this.logs.splice(i, 1);
    return before - this.logs.length;
  }
}
