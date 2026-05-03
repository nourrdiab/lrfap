import type { ID, ISODateString } from './common';
import type { University } from './catalog';

/**
 * Mirrors backend `models/ApplicantProfile.js`. All fields are flat except
 * `languages`, which is a keyed object (not an array). Emergency contact
 * is three flat top-level fields — no wrapper object, no email.
 *
 * Backend field name is `user` (ObjectId ref), not `userId`. Profile
 * completion is a boolean flag, not a 0-100 percentage (the dashboard
 * endpoint computes a percentage separately).
 */

export type LanguageCode = 'english' | 'french' | 'arabic';
export type LanguageLevel = 'none' | 'basic' | 'intermediate' | 'fluent' | 'native';

export type ApplicantLanguages = Partial<Record<LanguageCode, LanguageLevel>>;

export interface ApplicantProfile {
  _id: ID;
  user: ID;
  dateOfBirth?: ISODateString;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  nationality?: string;
  nationalId?: string;
  phone?: string;
  address?: string;
  city?: string;

  /**
   * University._id, populated University, or undefined if using
   * medicalSchoolOther. University-review responses populate the ref.
   */
  medicalSchool?: ID | University;
  medicalSchoolOther?: string;
  graduationYear?: number;
  gpa?: number; // 0-4
  classRank?: string;

  languages?: ApplicantLanguages;

  usmleStep1?: number; // 0-100
  usmleStep2?: number; // 0-100

  research?: string;
  publications?: string;
  workExperience?: string;
  extracurriculars?: string;

  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;

  profileCompleted?: boolean;
  createdAt?: ISODateString;
  updatedAt?: ISODateString;
}
