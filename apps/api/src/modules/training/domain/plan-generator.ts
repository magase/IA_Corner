import type {
  Difficulty,
  EquipmentType,
  ExerciseCategory,
  Level,
  MeasureType,
  Muscle,
  SessionBlock,
  SessionFocus,
  TrainingGoal,
} from '@corner/shared';

export const GENERATOR_VERSION = 'det-3';

export interface ExerciseCandidate {
  slug: string;
  category: ExerciseCategory;
  difficulty: Difficulty;
  measureType: MeasureType;
  primaryMuscles: Muscle[];
  equipment: EquipmentType[];
  sports: string[];
  defaults: {
    sets: number | null;
    reps: string | null;
    seconds: number | null;
    restSec: number | null;
  };
}

export interface GeneratorInput {
  goal: TrainingGoal;
  level: Level;
  daysPerWeek: number;
  sessionMinutes: number;
  sports: string[];
  equipment: EquipmentType[];
}

export interface PlannedExercise {
  slug: string;
  block: SessionBlock;
  sets: number | null;
  reps: string | null;
  seconds: number | null;
  rounds: number | null;
  restSec: number | null;
}

export interface PlannedSession {
  dayOfWeek: number;
  focus: SessionFocus;
  exercises: PlannedExercise[];
}

export interface PlanDraft {
  name: string;
  goal: TrainingGoal;
  generatorVersion: string;
  sessions: PlannedSession[];
}

// ─── Reparto semanal ─────────────────────────────────────────────────────────
// Lunes=1 … Domingo=7. Se separan los días de pierna pesada y de potencia para
// no acumular fatiga de tren inferior en días seguidos.
const WEEK: Record<number, [number, SessionFocus][]> = {
  1: [[1, 'STRENGTH_FULL']],
  2: [
    [1, 'STRENGTH_FULL'],
    [4, 'SPORT_CONDITIONING'],
  ],
  3: [
    [1, 'STRENGTH_FULL'],
    [3, 'SPORT_TECHNIQUE'],
    [5, 'POWER'],
  ],
  4: [
    [1, 'STRENGTH_LOWER'],
    [2, 'SPORT_TECHNIQUE'],
    [4, 'STRENGTH_UPPER'],
    [5, 'SPORT_CONDITIONING'],
  ],
  5: [
    [1, 'STRENGTH_LOWER'],
    [2, 'SPORT_TECHNIQUE'],
    [3, 'STRENGTH_UPPER'],
    [5, 'SPORT_CONDITIONING'],
    [6, 'MOBILITY_RECOVERY'],
  ],
  6: [
    [1, 'STRENGTH_LOWER'],
    [2, 'SPORT_TECHNIQUE'],
    [3, 'STRENGTH_UPPER'],
    [4, 'MOBILITY_RECOVERY'],
    [5, 'POWER'],
    [6, 'SPORT_CONDITIONING'],
  ],
  7: [
    [1, 'STRENGTH_LOWER'],
    [2, 'SPORT_TECHNIQUE'],
    [3, 'STRENGTH_UPPER'],
    [4, 'MOBILITY_RECOVERY'],
    [5, 'POWER'],
    [6, 'SPORT_CONDITIONING'],
    [7, 'MOBILITY_RECOVERY'],
  ],
};

/** El objetivo ajusta el reparto: técnica sustituye acondicionamiento y viceversa. */
function weekFor(goal: TrainingGoal, days: number): [number, SessionFocus][] {
  const base = WEEK[Math.min(7, Math.max(1, days))] ?? [];
  return base.map(([d, f]) => {
    if (goal === 'TECHNIQUE' && f === 'SPORT_CONDITIONING') return [d, 'SPORT_TECHNIQUE'];
    if (
      (goal === 'CONDITIONING' || goal === 'BODY_COMPOSITION') &&
      f === 'SPORT_TECHNIQUE' &&
      days >= 4
    ) {
      return [d, 'SPORT_CONDITIONING'];
    }
    // Nunca se añaden días extra de potencia: los saltos de alto impacto necesitan
    // al menos un día entre sesiones.
    return [d, f];
  });
}

// ─── Selección de ejercicios ────────────────────────────────────────────────
const LOWER: Muscle[] = ['QUADRICEPS', 'HAMSTRINGS', 'GLUTES', 'CALVES', 'ADDUCTORS', 'ABDUCTORS'];
/** Patrones de empuje/tracción. Cuello y antebrazo son accesorios: no ocupan huecos principales. */
const UPPER: Muscle[] = ['CHEST', 'LATS', 'UPPER_BACK', 'SHOULDERS', 'TRICEPS', 'BICEPS'];
const CORE: Muscle[] = ['CORE', 'OBLIQUES', 'LOWER_BACK'];
/** Zonas para elegir calentamiento y vuelta a la calma acordes a la sesión. */
const LOWER_REGION: Muscle[] = [...LOWER, 'HIP_FLEXORS', 'LOWER_BACK'];
const UPPER_REGION: Muscle[] = [...UPPER, 'NECK', 'FOREARMS'];
/** Ejercicios donde no tiene sentido un esquema de fuerza máxima (4-6) ni de hipertrofia. */
const ACCESSORY: Muscle[] = ['CALVES', 'CORE', 'OBLIQUES', 'LOWER_BACK', 'NECK', 'FOREARMS'];
const LOADED: EquipmentType[] = ['BARBELL', 'DUMBBELLS', 'KETTLEBELL'];

const DIFFICULTY_RANK: Record<Difficulty, number> = { BEGINNER: 0, INTERMEDIATE: 1, ADVANCED: 2 };
const MAX_DIFFICULTY: Record<Level, number> = {
  BEGINNER: 0,
  INTERMEDIATE: 1,
  ADVANCED: 2,
  COMPETITOR: 2,
};

interface Slot {
  block: SessionBlock;
  category: ExerciseCategory;
  muscles?: Muscle[];
  /** Prioriza ejercicios que trabajen esta zona (calentamiento / vuelta a la calma). */
  region?: Muscle[];
  maxDifficulty?: Difficulty;
  count: number;
}

/** Nº de ejercicios del bloque principal según la duración (≈10 min por ejercicio). */
export function mainCount(minutes: number): number {
  return Math.min(6, Math.max(2, Math.floor((minutes - 20) / 10)));
}

/** Minutos reservados fuera del bloque principal: calentamiento, finalizador y vuelta a la calma. */
const WARMUP_MIN = 8;
const FINISHER_MIN = 5;
const COOLDOWN_MIN = 6;

function slotsFor(focus: SessionFocus, minutes: number): Slot[] {
  const main = mainCount(minutes);
  const region =
    focus === 'STRENGTH_LOWER' || focus === 'POWER'
      ? LOWER_REGION
      : focus === 'STRENGTH_UPPER'
        ? UPPER_REGION
        : undefined;
  const withRegion = (slot: Slot): Slot => (region ? { ...slot, region } : slot);
  const warmup = withRegion({
    block: 'WARMUP',
    category: 'MOBILITY',
    count: minutes >= 45 ? 3 : 2,
  });
  const cooldown = withRegion({
    block: 'COOLDOWN',
    category: 'FLEXIBILITY',
    count: minutes >= 60 ? 3 : 2,
  });
  const core: Slot = { block: 'FINISHER', category: 'STRENGTH', muscles: CORE, count: 1 };
  switch (focus) {
    case 'STRENGTH_FULL':
      return [
        warmup,
        { block: 'MAIN', category: 'STRENGTH', muscles: LOWER, count: Math.ceil(main / 2) },
        { block: 'MAIN', category: 'STRENGTH', muscles: UPPER, count: Math.floor(main / 2) },
        core,
        cooldown,
      ];
    case 'STRENGTH_LOWER':
      return [
        warmup,
        { block: 'MAIN', category: 'STRENGTH', muscles: LOWER, count: main },
        core,
        cooldown,
      ];
    case 'STRENGTH_UPPER':
      return [
        warmup,
        { block: 'MAIN', category: 'STRENGTH', muscles: UPPER, count: main },
        core,
        cooldown,
      ];
    case 'POWER':
      return [
        warmup,
        // Calentamiento específico: un salto de baja intensidad antes de los pliométricos exigentes.
        { block: 'WARMUP', category: 'PLYOMETRICS', maxDifficulty: 'BEGINNER', count: 1 },
        { block: 'MAIN', category: 'PLYOMETRICS', count: Math.max(2, main - 1) },
        { block: 'MAIN', category: 'STRENGTH', muscles: LOWER, count: 1 },
        cooldown,
      ];
    case 'SPORT_TECHNIQUE':
      return [warmup, { block: 'MAIN', category: 'SPORT_DRILL', count: main }, cooldown];
    case 'SPORT_CONDITIONING':
      // Finalizador de core (no pliométrico): los saltos solo van en días de potencia, descansados.
      return [
        warmup,
        { block: 'MAIN', category: 'SPORT_DRILL', count: Math.max(2, main - 1) },
        core,
        cooldown,
      ];
    case 'MOBILITY_RECOVERY':
      return [
        { block: 'MAIN', category: 'MOBILITY', count: Math.max(3, main) },
        { block: 'COOLDOWN', category: 'FLEXIBILITY', count: Math.max(3, main) },
      ];
  }
}

/** Prescripción según objetivo y nivel (punto de partida conservador; el usuario la ajusta). */
function prescribe(
  c: ExerciseCandidate,
  block: SessionBlock,
  input: GeneratorInput,
  /** Segundos disponibles para este ejercicio dentro del bloque principal. */
  budgetSec: number,
): Omit<PlannedExercise, 'slug' | 'block'> {
  const beginner = input.level === 'BEGINNER';
  const d = c.defaults;
  if (c.measureType === 'ROUNDS') {
    const conditioning = input.goal === 'CONDITIONING' || input.goal === 'BODY_COMPOSITION';
    const seconds = d.seconds ?? 180;
    const rest = conditioning ? Math.max(30, (d.restSec ?? 60) - 15) : (d.restSec ?? 60);
    const wanted = Math.min(8, (d.sets ?? 3) + (beginner ? -1 : 0) + (conditioning ? 1 : 0));
    // Los rounds se ajustan al tiempo disponible de la sesión.
    const fit = Math.floor((budgetSec + rest) / (seconds + rest));
    const rounds = Math.max(2, Math.min(wanted, fit));
    return { sets: null, reps: null, seconds, rounds, restSec: rest };
  }
  if (block === 'WARMUP' || block === 'COOLDOWN') {
    const plyoWarmup = block === 'WARMUP' && c.category === 'PLYOMETRICS';
    return {
      sets: plyoWarmup ? 2 : 1,
      reps: c.measureType === 'REPS' ? d.reps : null,
      seconds: c.measureType === 'REPS' ? null : (d.seconds ?? 30),
      rounds: null,
      restSec: plyoWarmup ? 30 : 0,
    };
  }
  let sets = d.sets ?? 3;
  let reps = d.reps;
  let rest = d.restSec;
  if (beginner) sets = Math.max(2, sets - 1);
  const compoundLoaded =
    block === 'MAIN' &&
    c.category === 'STRENGTH' &&
    c.measureType === 'REPS' &&
    c.equipment.some((e) => LOADED.includes(e)) &&
    !c.primaryMuscles.some((m) => ACCESSORY.includes(m));
  if (compoundLoaded) {
    if (input.goal === 'STRENGTH_POWER') {
      reps = '4-6';
      rest = Math.max(rest ?? 120, 150);
      // Sin series extra en ejercicios avanzados (p. ej. excéntricos exigentes).
      if (!beginner && c.difficulty !== 'ADVANCED') sets = Math.min(5, sets + 1);
    } else if (input.goal === 'BODY_COMPOSITION' || input.goal === 'CONDITIONING') {
      reps = '10-15';
      rest = Math.min(rest ?? 75, 75);
    }
  }
  return {
    sets,
    reps: c.measureType === 'REPS' ? reps : null,
    seconds: c.measureType === 'REPS' ? null : (d.seconds ?? 30),
    rounds: null,
    restSec: rest,
  };
}

/**
 * Generador determinista del plan gratuito.
 * Las mismas entradas y el mismo catálogo producen siempre el mismo plan.
 */
export function generateTrainingPlan(
  input: GeneratorInput,
  catalog: readonly ExerciseCandidate[],
): PlanDraft {
  const available = new Set<EquipmentType>(
    input.equipment.includes('FULL_GYM') ? [] : [...input.equipment, 'NONE'],
  );
  const fullGym = input.equipment.includes('FULL_GYM');
  const maxDiff = MAX_DIFFICULTY[input.level];

  const pool = [...catalog]
    .filter((c) => DIFFICULTY_RANK[c.difficulty] <= maxDiff)
    .filter((c) => fullGym || c.equipment.every((e) => available.has(e)))
    .filter((c) => c.category !== 'SPORT_DRILL' || c.sports.some((s) => input.sports.includes(s)))
    // Orden estable: primero la dificultad más cercana al nivel, luego slug.
    .sort(
      (a, b) =>
        DIFFICULTY_RANK[b.difficulty] - DIFFICULTY_RANK[a.difficulty] ||
        a.slug.localeCompare(b.slug),
    );

  const usedThisWeek = new Map<string, number>();
  let sportCursor = 0;

  const pick = (slot: Slot, inSession: Set<string>): ExerciseCandidate[] => {
    const covered = new Set<Muscle>();
    const chosen: ExerciseCandidate[] = [];
    const maxSlot = slot.maxDifficulty ? DIFFICULTY_RANK[slot.maxDifficulty] : 2;
    const overlap = (c: ExerciseCandidate) =>
      slot.region ? c.primaryMuscles.filter((m) => slot.region?.includes(m)).length : 0;
    const matches = pool.filter(
      (c) =>
        c.category === slot.category &&
        !inSession.has(c.slug) &&
        DIFFICULTY_RANK[c.difficulty] <= maxSlot &&
        (!slot.muscles || c.primaryMuscles.some((m) => slot.muscles?.includes(m))),
    );
    // Afinidad con la zona de la sesión, luego los menos usados esta semana (variedad),
    // sin romper el orden estable.
    const ranked = [...matches].sort(
      (a, b) =>
        overlap(b) - overlap(a) ||
        (usedThisWeek.get(a.slug) ?? 0) - (usedThisWeek.get(b.slug) ?? 0),
    );

    if (slot.category === 'SPORT_DRILL' && input.sports.length > 1) {
      // Reparto por turnos entre los deportes del usuario.
      const bySport = input.sports.map((s) => ranked.filter((c) => c.sports.includes(s)));
      for (let i = 0; chosen.length < slot.count && i < slot.count * input.sports.length * 2; i++) {
        const list = bySport[(sportCursor + i) % input.sports.length] ?? [];
        const next = list.find((c) => !chosen.includes(c));
        if (next) chosen.push(next);
      }
      sportCursor++;
      return chosen;
    }
    // Primero cubrir músculos distintos; luego completar.
    for (const c of ranked) {
      if (chosen.length >= slot.count) break;
      if (c.primaryMuscles.some((m) => covered.has(m))) continue;
      chosen.push(c);
      c.primaryMuscles.forEach((m) => covered.add(m));
    }
    for (const c of ranked) {
      if (chosen.length >= slot.count) break;
      if (!chosen.includes(c)) chosen.push(c);
    }
    return chosen;
  };

  const build = (dayOfWeek: number, focus: SessionFocus): PlannedSession => {
    const inSession = new Set<string>();
    const picked: { c: ExerciseCandidate; slot: Slot }[] = [];
    const slots = slotsFor(focus, input.sessionMinutes);
    for (const slot of slots) {
      for (const c of pick(slot, inSession)) {
        inSession.add(c.slug);
        picked.push({ c, slot });
      }
    }
    // Presupuesto de tiempo del bloque principal, repartido entre sus ejercicios.
    const hasFinisher = slots.some((x) => x.block === 'FINISHER');
    const mainItems = picked.filter((p) => p.slot.block === 'MAIN').length || 1;
    const mainMinutes = Math.max(
      10,
      input.sessionMinutes - WARMUP_MIN - COOLDOWN_MIN - (hasFinisher ? FINISHER_MIN : 0),
    );
    const budgetSec = (mainMinutes * 60) / mainItems;
    return {
      dayOfWeek,
      focus,
      exercises: picked.map(({ c, slot }) => ({
        slug: c.slug,
        block: slot.block,
        ...prescribe(c, slot.block, input, budgetSec),
      })),
    };
  };
  const hasMain = (x: PlannedSession) => x.exercises.some((e) => e.block === 'MAIN');

  const sessions: PlannedSession[] = [];
  for (const [dayOfWeek, focus] of weekFor(input.goal, input.daysPerWeek)) {
    // Si el catálogo (material/nivel) no cubre el enfoque, se prueba uno alternativo
    // en lugar de perder el día de entrenamiento.
    for (const f of [focus, ...(FALLBACKS[focus] ?? [])]) {
      const session = build(dayOfWeek, f);
      if (!hasMain(session)) continue;
      session.exercises.forEach((e) =>
        usedThisWeek.set(e.slug, (usedThisWeek.get(e.slug) ?? 0) + 1),
      );
      sessions.push(session);
      break;
    }
  }

  return {
    name: `${input.goal}_${sessions.length}D`,
    goal: input.goal,
    generatorVersion: GENERATOR_VERSION,
    sessions,
  };
}

/** Enfoques alternativos si el catálogo disponible no cubre el original. */
const FALLBACKS: Partial<Record<SessionFocus, SessionFocus[]>> = {
  STRENGTH_LOWER: ['STRENGTH_FULL', 'SPORT_CONDITIONING', 'MOBILITY_RECOVERY'],
  STRENGTH_UPPER: ['STRENGTH_FULL', 'SPORT_CONDITIONING', 'MOBILITY_RECOVERY'],
  STRENGTH_FULL: ['SPORT_CONDITIONING', 'MOBILITY_RECOVERY'],
  POWER: ['STRENGTH_FULL', 'SPORT_CONDITIONING', 'MOBILITY_RECOVERY'],
  SPORT_TECHNIQUE: ['SPORT_CONDITIONING', 'MOBILITY_RECOVERY'],
  SPORT_CONDITIONING: ['SPORT_TECHNIQUE', 'MOBILITY_RECOVERY'],
};
