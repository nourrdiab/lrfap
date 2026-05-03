import type { ID, ISODateString } from './common';
import type { User } from './user';

/**
 * Mirrors backend `models/ProgramRanking.js`. The original scaffold shape
 * (entries/programId/cycleId, no status field) didn't match what the API
 * actually returns — this rewrite aligns with the backend.
 *
 * The nested `applicant` ref is populated by the backend on GET and on
 * the PUT response (`firstName lastName email`); `submittedBy` is not
 * populated today but is typed permissively so we can do either.
 *
 * `ProgramApplicationSummary` is kept around as an unused but referenced
 * legacy scaffold type — no current caller, but the shape is a reasonable
 * reference for future thin-list endpoints.
 */

export interface ProgramApplicationSummary {
  applicationId: ID;
  applicantId: ID;
  applicantName: string;
  applicantRank?: number;
  gpa?: number;
  usmleStep1?: number;
  usmleStep2?: number;
  documentsComplete?: boolean;
  reviewStatus?: 'unreviewed' | 'in_progress' | 'complete';
}

export type ProgramRankingStatus = 'draft' | 'submitted';

export interface RankedApplicant {
  applicant: ID | User;
  application: ID;
  rank: number;
  score?: number;
  notes?: string;
}

export interface ProgramRanking {
  /**
   * Missing when the backend hasn't persisted a document yet — see
   * `getProgramRanking`, which returns a synthetic empty draft on
   * first read instead of auto-creating a row. Populated once any PUT
   * creates the real row.
   */
  _id?: ID;
  program: ID;
  cycle: ID;
  rankedApplicants: RankedApplicant[];
  status: ProgramRankingStatus;
  submittedAt?: ISODateString;
  submittedBy?: ID | User;
  createdAt?: ISODateString;
  updatedAt?: ISODateString;
}

/** Shape accepted by PUT /university-review/programs/:id/ranking. */
export interface RankingEntryInput {
  applicant: ID;
  application: ID;
  rank: number;
  score?: number;
  notes?: string;
}
