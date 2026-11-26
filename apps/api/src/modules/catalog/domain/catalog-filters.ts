import type { Difficulty, EquipmentType, ExerciseCategory, WikiCategory } from '@corner/shared';
import { ValidationError } from '../../../shared/domain/errors.js';

export const MAX_PAGE_SIZE = 50;
export const DEFAULT_PAGE_SIZE = 20;

export interface ExerciseFilter {
  category: ExerciseCategory | null;
  difficulty: Difficulty | null;
  sport: string | null;
  /** Material disponible: solo ejercicios cuyo material requerido esté TODO incluido. null = sin filtro. */
  availableEquipment: EquipmentType[] | null;
  search: string | null;
}

export interface Pagination {
  page: number;
  pageSize: number;
}

export interface WikiFilter {
  category: WikiCategory | null;
  search: string | null;
}

export function normalizePagination(page: number | null, pageSize: number | null): Pagination {
  const p = page ?? 1;
  const s = pageSize ?? DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(p) || p < 1) throw new ValidationError('page no válida', 'INVALID_PAGE');
  if (!Number.isInteger(s) || s < 1 || s > MAX_PAGE_SIZE) {
    throw new ValidationError(
      `pageSize debe estar entre 1 y ${MAX_PAGE_SIZE}`,
      'INVALID_PAGE_SIZE',
    );
  }
  return { page: p, pageSize: s };
}

export function normalizeSearch(q: string | null): string | null {
  const t = q?.trim().replace(/\s+/g, ' ') ?? '';
  if (t.length === 0) return null;
  if (t.length > 80) throw new ValidationError('Búsqueda demasiado larga', 'SEARCH_TOO_LONG');
  return t;
}

/**
 * "Gimnasio completo" equivale a tenerlo todo: no se filtra.
 * El peso corporal (NONE) siempre está disponible.
 */
export function normalizeEquipment(list: EquipmentType[] | null): EquipmentType[] | null {
  if (!list || list.length === 0) return null;
  if (list.includes('FULL_GYM')) return null;
  return [...new Set<EquipmentType>([...list, 'NONE'])];
}

const HEALTH_CATEGORIES: readonly WikiCategory[] = [
  'MACRONUTRIENT',
  'MICRONUTRIENT',
  'HYDRATION',
  'SUPPLEMENT',
];

export function requiresHealthDisclaimer(category: WikiCategory): boolean {
  return HEALTH_CATEGORIES.includes(category);
}
