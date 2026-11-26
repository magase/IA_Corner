import type { ExerciseCandidate } from '../../src/modules/training/domain/plan-generator.js';

const c = (
  slug: string,
  category: ExerciseCandidate['category'],
  primaryMuscles: ExerciseCandidate['primaryMuscles'],
  over: Partial<ExerciseCandidate> = {},
): ExerciseCandidate => ({
  slug,
  category,
  difficulty: 'BEGINNER',
  measureType: category === 'SPORT_DRILL' ? 'ROUNDS' : category === 'FLEXIBILITY' ? 'TIME' : 'REPS',
  primaryMuscles,
  equipment: ['NONE'],
  sports: [],
  defaults:
    category === 'SPORT_DRILL'
      ? { sets: 3, reps: null, seconds: 180, restSec: 60 }
      : category === 'FLEXIBILITY'
        ? { sets: 1, reps: null, seconds: 30, restSec: 0 }
        : { sets: 3, reps: '8-12', seconds: null, restSec: 90 },
  ...over,
});

/** Catálogo sintético suficiente para todas las sesiones. */
export const CANDIDATES: ExerciseCandidate[] = [
  c('goblet-squat', 'STRENGTH', ['QUADRICEPS', 'GLUTES'], { equipment: ['DUMBBELLS'] }),
  c('split-squat', 'STRENGTH', ['QUADRICEPS']),
  c('glute-bridge', 'STRENGTH', ['GLUTES']),
  c('nordic-curl', 'STRENGTH', ['HAMSTRINGS'], { difficulty: 'ADVANCED' }),
  c('calf-raise', 'STRENGTH', ['CALVES']),
  c('barbell-deadlift', 'STRENGTH', ['HAMSTRINGS', 'GLUTES'], {
    equipment: ['BARBELL'],
    difficulty: 'INTERMEDIATE',
  }),
  c('push-up', 'STRENGTH', ['CHEST', 'TRICEPS']),
  c('pull-up', 'STRENGTH', ['LATS', 'BICEPS'], {
    equipment: ['PULL_UP_BAR'],
    difficulty: 'INTERMEDIATE',
  }),
  c('band-row', 'STRENGTH', ['UPPER_BACK'], { equipment: ['RESISTANCE_BAND'] }),
  c('pike-push-up', 'STRENGTH', ['SHOULDERS']),
  c('dead-bug', 'STRENGTH', ['CORE']),
  c('side-plank', 'STRENGTH', ['OBLIQUES'], {
    measureType: 'TIME',
    defaults: { sets: 3, reps: null, seconds: 30, restSec: 45 },
  }),
  c('squat-jump', 'PLYOMETRICS', ['QUADRICEPS']),
  c('broad-jump', 'PLYOMETRICS', ['GLUTES']),
  c('skater-hop', 'PLYOMETRICS', ['ABDUCTORS']),
  c('plyo-push-up', 'PLYOMETRICS', ['CHEST'], { difficulty: 'INTERMEDIATE' }),
  c('hip-circles', 'MOBILITY', ['HIP_FLEXORS']),
  c('thoracic-rotation', 'MOBILITY', ['UPPER_BACK']),
  c('ankle-rocks', 'MOBILITY', ['CALVES']),
  c('shoulder-cars', 'MOBILITY', ['SHOULDERS']),
  c('hamstring-stretch', 'FLEXIBILITY', ['HAMSTRINGS']),
  c('hip-flexor-stretch', 'FLEXIBILITY', ['HIP_FLEXORS']),
  c('adductor-stretch', 'FLEXIBILITY', ['ADDUCTORS']),
  c('chest-stretch', 'FLEXIBILITY', ['CHEST']),
  ...['shadow', 'bag-teeps', 'bag-knees', 'jump-rope-rounds'].map((n) =>
    c(`muay-thai-${n}`, 'SPORT_DRILL', ['FULL_BODY'], { sports: ['MUAY_THAI'] }),
  ),
  ...['shadow', 'bag-jab-cross', 'slip-line', 'footwork-box'].map((n) =>
    c(`boxing-${n}`, 'SPORT_DRILL', ['FULL_BODY'], { sports: ['BOXING'] }),
  ),
  c('judo-uchikomi', 'SPORT_DRILL', ['FULL_BODY'], { sports: ['JUDO'] }),
];
