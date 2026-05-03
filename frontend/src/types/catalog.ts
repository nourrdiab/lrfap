import type { ID, ISODateString } from './common';

/**
 * Mirrors backend models/{University,Specialty,Program,Cycle}.js exactly.
 *
 * Reference fields use `ID | Populated` so consumers can handle both
 * raw ObjectId strings and populated documents (backend populates liberally
 * on most read paths; see programController.getPrograms which populates
 * university[name,code,city] + specialty[name,code] + cycle[name,year,status]).
 *
 * Specialty is NOT track-specific on the backend — a specialty can back
 * residency AND fellowship programs. Track is tied to Program, not
 * Specialty. Similarly, Cycle is NOT track-specific; a single cycle
 * covers both residency and fellowship applications.
 */

export type Track = 'residency' | 'fellowship';

export type CycleStatus =
  | 'draft'
  | 'open'
  | 'review'
  | 'ranking'
  | 'matching'
  | 'published'
  | 'closed';

export type LanguageRequirement = 'english' | 'french' | 'arabic' | 'none';

export interface University {
  _id: ID;
  name: string;
  code: string;
  city?: string;
  website?: string;
  contactEmail?: string;
  isActive?: boolean;
  createdAt?: ISODateString;
  updatedAt?: ISODateString;
}

export interface Specialty {
  _id: ID;
  name: string;
  code: string;
  description?: string;
  nationalQuota?: number | null;
  isActive?: boolean;
  createdAt?: ISODateString;
  updatedAt?: ISODateString;
}

export interface Program {
  _id: ID;
  university: ID | University;
  specialty: ID | Specialty;
  cycle: ID | Cycle;
  track: Track;
  capacity: number;
  availableSeats: number;
  durationYears: number;
  description?: string;
  extraRequirements?: string[];
  languageRequirement?: LanguageRequirement;
  isActive?: boolean;
  createdAt?: ISODateString;
  updatedAt?: ISODateString;
}

export interface Cycle {
  _id: ID;
  name: string;
  year: number;
  status: CycleStatus;
  startDate: ISODateString;
  endDate: ISODateString;
  submissionDeadline: ISODateString;
  rankingDeadline: ISODateString;
  resultPublicationDate: ISODateString;
  acceptanceWindowHours?: number;
  createdAt?: ISODateString;
  updatedAt?: ISODateString;
}
