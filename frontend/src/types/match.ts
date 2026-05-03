import type { ID, ISODateString } from './common';
import type { Cycle, Program, Track } from './catalog';
import type { User } from './user';

/**
 * Mirrors backend `models/MatchRun.js`. The earlier scaffold shape
 * (cycleId/type/matchedCount/etc.) didn't match the backend — this is
 * the real one.
 *
 * "Published" is NOT a field on MatchRun. It's stored on the Cycle
 * (cycle.status === 'published'). A MatchRun is "live" when
 * runType === 'official' AND status === 'completed' AND its cycle's
 * status is 'published'.
 */

export type MatchRunType = 'dry_run' | 'official';
export type MatchRunStatus = 'running' | 'completed' | 'failed';

export interface MatchRunInputsSnapshot {
  applicantCount?: number;
  programCount?: number;
  totalCapacity?: number;
}

export interface MatchPairing {
  applicantId: ID | User;
  programId: ID | Program;
}

export interface MatchProgramFill {
  programId: ID | Program;
  capacity: number;
  filled: number;
  unfilled: number;
}

export interface MatchRunResults {
  totalMatched?: number;
  totalUnmatched?: number;
  iterations?: number;
  matches?: MatchPairing[];
  unmatchedApplicants?: Array<ID | User>;
  programFillRates?: MatchProgramFill[];
}

export interface MatchRun {
  _id: ID;
  cycle: ID | Cycle;
  track: Track;
  runType: MatchRunType;
  status: MatchRunStatus;
  executedBy?: ID | User;
  inputsSnapshot?: MatchRunInputsSnapshot;
  tieBreakRule?: string;
  results?: MatchRunResults;
  error?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Envelope shape returned by POST /match/dry-run and /match/execute. */
export interface MatchExecuteResponse {
  message: string;
  matchRunId: ID;
  summary: {
    totalApplicants: number;
    totalPrograms?: number;
    totalMatched: number;
    totalUnmatched: number;
    iterations: number;
  };
}

/** Envelope returned by POST /match/publish. */
export interface MatchPublishResponse {
  message: string;
  cycle: Cycle;
  matchRunId: ID;
}
