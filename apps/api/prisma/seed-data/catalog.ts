import type { EquipmentType, GrapplingSport, StrikingSport } from '@corner/shared';

type T = { es: string; en: string };

export const STRIKING: Record<StrikingSport, { name: T; description: T }> = {
  MUAY_THAI: {
    name: { es: 'Muay Thai', en: 'Muay Thai' },
    description: {
      es: 'El arte de las ocho extremidades: puños, codos, rodillas y patadas, con trabajo de clinch.',
      en: 'The art of eight limbs: punches, elbows, knees and kicks, plus clinch work.',
    },
  },
  BOXING: {
    name: { es: 'Boxeo', en: 'Boxing' },
    description: {
      es: 'Deporte de golpeo con los puños centrado en el juego de pies, la defensa y las combinaciones.',
      en: 'Punching sport focused on footwork, defense and combinations.',
    },
  },
  KICKBOXING: {
    name: { es: 'Kickboxing', en: 'Kickboxing' },
    description: {
      es: 'Combina el boxeo con patadas, buscando volumen y ritmo de golpeo.',
      en: 'Combines boxing with kicks, emphasizing volume and striking rhythm.',
    },
  },
  TAEKWONDO: {
    name: { es: 'Taekwondo', en: 'Taekwondo' },
    description: {
      es: 'Arte marcial coreano caracterizado por patadas rápidas, altas y giratorias.',
      en: 'Korean martial art known for fast, high and spinning kicks.',
    },
  },
  KARATE: {
    name: { es: 'Karate', en: 'Karate' },
    description: {
      es: 'Arte marcial japonés de golpeo preciso, distancia y explosividad (kihon, kata y kumite).',
      en: 'Japanese martial art of precise striking, distance and explosiveness (kihon, kata, kumite).',
    },
  },
};

/** Solo en BD (isEnabled=false): la app no muestra sección de grappling todavía. */
export const GRAPPLING: Record<GrapplingSport, T> = {
  WRESTLING: { es: 'Lucha', en: 'Wrestling' },
  SAMBO: { es: 'Sambo', en: 'Sambo' },
  JUDO: { es: 'Judo', en: 'Judo' },
  BJJ: { es: 'Jiu-jitsu brasileño', en: 'Brazilian Jiu-Jitsu' },
};

export const EQUIPMENT: Record<EquipmentType, T> = {
  NONE: { es: 'Sin material (peso corporal)', en: 'No equipment (bodyweight)' },
  DUMBBELLS: { es: 'Mancuernas', en: 'Dumbbells' },
  KETTLEBELL: { es: 'Kettlebell', en: 'Kettlebell' },
  BARBELL: { es: 'Barra olímpica', en: 'Barbell' },
  RESISTANCE_BAND: { es: 'Bandas elásticas', en: 'Resistance bands' },
  PULL_UP_BAR: { es: 'Barra de dominadas', en: 'Pull-up bar' },
  HEAVY_BAG: { es: 'Saco de boxeo', en: 'Heavy bag' },
  JUMP_ROPE: { es: 'Comba', en: 'Jump rope' },
  BOX: { es: 'Cajón pliométrico', en: 'Plyo box' },
  MEDICINE_BALL: { es: 'Balón medicinal', en: 'Medicine ball' },
  FULL_GYM: { es: 'Gimnasio completo', en: 'Full gym' },
};
