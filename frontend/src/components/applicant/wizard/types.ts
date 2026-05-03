export type StepSlug =
  | 'profile'
  | 'documents'
  | 'programs'
  | 'preference-ranking'
  | 'review';

export type StepStatus = 'complete' | 'inProgress' | 'pending';

export interface StepDef {
  slug: StepSlug;
  label: string;
  position: number;
}

/**
 * The canonical step order. Position is the 1-indexed number shown on the
 * step indicator for upcoming steps (completed steps show a checkmark).
 */
export const STEPS: readonly StepDef[] = [
  { slug: 'profile', label: 'PROFILE', position: 1 },
  { slug: 'documents', label: 'DOCUMENTS', position: 2 },
  { slug: 'programs', label: 'PROGRAMS', position: 3 },
  { slug: 'preference-ranking', label: 'PREFERENCE RANKING', position: 4 },
  { slug: 'review', label: 'REVIEW & SUBMIT', position: 5 },
] as const;

export function isStepSlug(value: unknown): value is StepSlug {
  return STEPS.some((s) => s.slug === value);
}
