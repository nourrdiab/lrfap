import type { ID, ISODateString } from './common';
import type { ApplicantProfile } from './applicant';
import type { Cycle, Program, Track } from './catalog';
import type { User } from './user';

/**
 * Mirrors backend `models/Application.js`. Field names are the Mongoose
 * refs (`applicant`, `cycle`, `matchedProgram`), not the legacy scaffold
 * names (`applicantId`, `cycleId`, etc.). Populated paths on read use
 * `ID | Populated`.
 */

export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'matched'
  | 'unmatched'
  | 'withdrawn';

export type OfferStatus = 'none' | 'pending' | 'accepted' | 'declined' | 'expired';

export type ApplicationReviewState =
  | 'new'
  | 'under_review'
  | 'reviewed'
  | 'matched';

export interface ProgramSelection {
  program: ID | Program;
  rank: number;
  institutionSpecificFields?: Record<string, string>;
}

export interface Application {
  _id: ID;
  // Populated on university-review endpoints (firstName/lastName/email);
  // raw ObjectId elsewhere. Callers that need applicant details should
  // narrow with a type guard before reading fields.
  applicant: ID | User;
  cycle: ID | Cycle;
  track: Track;
  status: ApplicationStatus;
  selections: ProgramSelection[];
  declarationAccepted?: boolean;
  submittedAt?: ISODateString;
  submissionReference?: string;
  lockedAt?: ISODateString;
  matchedProgram?: ID | Program | null;
  offerStatus: OfferStatus;
  offerExpiresAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  /**
   * Per-university review state, attached by /university-review endpoints
   * relative to the requesting reviewer's institution. Undefined on
   * applicant-side responses.
   */
  reviewState?: ApplicationReviewState;
  /**
   * Applicant's reusable profile, attached by /university-review and LGC
   * application-detail endpoints. `null` when the applicant hasn't yet
   * filled out their profile; undefined on applicant-side responses.
   * `medicalSchool` is populated to a University when present.
   */
  applicantProfile?: ApplicantProfile | null;
}
