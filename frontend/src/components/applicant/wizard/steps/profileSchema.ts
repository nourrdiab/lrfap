import type { LanguageLevel } from '../../../../types';

/**
 * Static options for the Profile step's select dropdowns.
 */

export const GENDER_OPTIONS: Array<{ value: NonNullable<import('../../../../types').ApplicantProfile['gender']>; label: string }> = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export const LANGUAGE_LEVEL_OPTIONS: Array<{ value: LanguageLevel; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'basic', label: 'Basic' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'fluent', label: 'Fluent' },
  { value: 'native', label: 'Native' },
];

/** Sentinel value for the "Other" medical-school option. */
export const MEDICAL_SCHOOL_OTHER = '__other__';

export type ProfileSectionId =
  | 'personal'
  | 'contact'
  | 'academic'
  | 'languages'
  | 'tests'
  | 'experience'
  | 'emergency';

export const DEFAULT_SECTIONS_OPEN: Record<ProfileSectionId, boolean> = {
  personal: true,
  contact: true,
  academic: true,
  languages: true,
  tests: true,
  experience: true,
  emergency: true,
};
