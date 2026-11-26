import {
  TIER_ENTITLEMENTS,
  type Locale,
  type WorkoutHistoryDto,
  type WorkoutLogDto,
} from '@corner/shared';
import type { EntitlementsReader } from '../../../shared/application/entitlements.js';
import type { Clock } from '../../../shared/application/ports.js';
import { NotFoundError, PremiumRequiredError } from '../../../shared/domain/errors.js';
import { validateWorkout, type WorkoutLogInput } from '../domain/workout.js';

export interface WorkoutRepository {
  /**
   * Inserta el registro solo si el usuario tiene menos de `limit` (null = sin límite).
   * Debe ser atómico frente a inserciones concurrentes del mismo usuario.
   * Lanza ValidationError si algún ejercicio o la sesión del plan no existen o no son suyos.
   */
  insertIfUnderLimit(
    userId: string,
    log: WorkoutLogInput,
    limit: number | null,
  ): Promise<{ inserted: false; used: number } | { inserted: true; id: string; used: number }>;
  list(
    userId: string,
    page: { page: number; pageSize: number },
  ): Promise<{ items: WorkoutHistoryDto['items']; total: number }>;
  get(userId: string, id: string, locale: Locale): Promise<WorkoutLogDto | null>;
  delete(userId: string, id: string): Promise<boolean>;
  deleteAll(userId: string): Promise<number>;
}

async function limitFor(entitlements: EntitlementsReader, userId: string): Promise<number | null> {
  const plan = await entitlements.forUser(userId);
  return TIER_ENTITLEMENTS[plan.tier].limits.workoutLogRows;
}

export class WorkoutService {
  constructor(
    private readonly repo: WorkoutRepository,
    private readonly entitlements: EntitlementsReader,
    private readonly clock: Clock,
  ) {}

  async log(userId: string, input: WorkoutLogInput, locale: Locale): Promise<WorkoutLogDto> {
    const log = validateWorkout(input, this.clock.now());
    const limit = await limitFor(this.entitlements, userId);
    const r = await this.repo.insertIfUnderLimit(userId, log, limit);
    if (!r.inserted) {
      throw new PremiumRequiredError(
        `Has alcanzado el máximo de ${limit} registros del plan gratuito. Hazte premium o borra registros antiguos.`,
        'WORKOUT_LOG_LIMIT',
        { limit, used: r.used },
      );
    }
    const saved = await this.repo.get(userId, r.id, locale);
    if (!saved) throw new NotFoundError('Registro no encontrado', 'WORKOUT_NOT_FOUND');
    return saved;
  }

  async history(userId: string, page: number, pageSize: number): Promise<WorkoutHistoryDto> {
    const [{ items, total }, limit] = await Promise.all([
      this.repo.list(userId, { page, pageSize }),
      limitFor(this.entitlements, userId),
    ]);
    return { items, total, limit };
  }

  async get(userId: string, id: string, locale: Locale): Promise<WorkoutLogDto> {
    const w = await this.repo.get(userId, id, locale);
    if (!w) throw new NotFoundError('Registro no encontrado', 'WORKOUT_NOT_FOUND');
    return w;
  }

  async delete(userId: string, id: string): Promise<void> {
    if (!(await this.repo.delete(userId, id))) {
      throw new NotFoundError('Registro no encontrado', 'WORKOUT_NOT_FOUND');
    }
  }

  async deleteAll(userId: string): Promise<{ deleted: number }> {
    return { deleted: await this.repo.deleteAll(userId) };
  }
}
