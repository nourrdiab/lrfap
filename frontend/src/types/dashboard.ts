import type { ID, ISODateString } from './common';
import type { Cycle, CycleStatus, Program, Track } from './catalog';
import type { ApplicationStatus, OfferStatus } from './application';

/**
 * Mirrors the actual `GET /api/dashboard/applicant` response
 * (controllers/dashboardController.js → getApplicantDashboard). The
 * outer shape hand-constructs objects with `id` fields, but populated
 * subdocuments (cycle, matchedProgram) serialize with Mongoose's
 * default `_id`.
 */

export interface DashboardUser {
  id: ID;
  firstName?: string;
  lastName?: string;
  email: string;
}

export interface DashboardActiveCycle {
  id: ID;
  name: string;
  year: number;
  status: string;
  submissionDeadline?: ISODateString;
  rankingDeadline?: ISODateString;
  resultPublicationDate?: ISODateString;
}

export interface DashboardChecklist {
  profileCompleted: boolean;
  hasDraft: boolean;
  hasSubmitted: boolean;
  hasMatch: boolean;
  hasPendingOffer: boolean;
}

export interface DashboardApplication {
  id: ID;
  cycle: ID | Cycle;
  track: Track;
  status: ApplicationStatus;
  submissionReference?: string;
  submittedAt?: ISODateString;
  matchedProgram?: ID | Program | null;
  offerStatus: OfferStatus;
  offerExpiresAt?: ISODateString;
}

export interface ApplicantDashboard {
  user: DashboardUser;
  profileCompletion: number;
  checklist: DashboardChecklist;
  applications: DashboardApplication[];
  activeCycle: DashboardActiveCycle | null;
}

/**
 * Mirrors `GET /api/dashboard/lgc` (controllers/dashboardController.js →
 * getLGCDashboard). Counts are nested; activeCycle is singular; capacity
 * is flat; applicationsBySpecialty is a pre-aggregated array; and
 * recentActivity comes from the AuditLog stream (last 10) with the
 * actor already flattened to a name string.
 *
 * The scaffold shape that existed before this rewrite
 * (`{totalApplicants, totalPrograms, activeCycles, applicationsByStatus, fillRate, …}`)
 * did NOT match reality. This is the real one.
 */

export interface LGCApplicationCounts {
  total: number;
  submitted: number;
  matched: number;
  unmatched: number;
}

export interface LGCCounts {
  applicants: number;
  universities: number;
  specialties: number;
  programs: number;
  applications: LGCApplicationCounts;
  rankingsSubmitted: number;
}

export interface LGCCapacity {
  totalCapacity: number;
  filledSeats: number;
  availableSeats: number;
  /** Percent 0–100, pre-computed by backend. */
  fillRate: number;
}

export interface LGCActiveCycle {
  id: ID;
  name: string;
  year: number;
  status: CycleStatus;
  submissionDeadline: ISODateString;
  rankingDeadline: ISODateString;
  resultPublicationDate: ISODateString;
}

export interface LGCApplicationsBySpecialty {
  specialty: string;
  code: string;
  count: number;
}

export interface LGCActivityEntry {
  id: ID;
  action: string;
  /** Pre-flattened "FirstName LastName" string (or "Unknown"). */
  actor: string;
  actorRole: string;
  targetType?: string;
  outcome?: 'success' | 'failure';
  createdAt: ISODateString;
}

export interface LGCDashboard {
  counts: LGCCounts;
  capacity: LGCCapacity;
  activeCycle: LGCActiveCycle | null;
  applicationsBySpecialty: LGCApplicationsBySpecialty[];
  recentActivity: LGCActivityEntry[];
}

/**
 * GET /api/dashboard/lgc/ranking-summary?cycle=<id>
 *
 * Aggregation response that replaces the old per-program ranking fetch
 * loop on the LGC dashboard. Universities with zero programs in the
 * queried cycle are omitted — the caller merges them from its own
 * universities list.
 */

export interface LGCRankingSummaryTrackStats {
  totalPrograms: number;
  submittedRankings: number;
  /**
   * Programs in this track that have ≥ 1 submitted application. Matching
   * only uses submitted applications, so programs without applicants
   * can't match anyone regardless of their ranking state — these are
   * the programs whose rankings actually matter for readiness.
   */
  programsWithApplicants: number;
  /**
   * Of the programs-with-applicants, how many have a submitted ranking.
   * Readiness is green when this equals `programsWithApplicants`.
   */
  programsWithApplicantsAndSubmittedRanking: number;
}

export interface LGCRankingSummaryUniversity {
  _id: ID;
  name: string;
  code: string;
  totalPrograms: number;
  submittedRankings: number;
  tracks: {
    residency: LGCRankingSummaryTrackStats;
    fellowship: LGCRankingSummaryTrackStats;
  };
  lastUpdatedAt: ISODateString | null;
}

export interface LGCRankingSummaryTotals {
  programs: number;
  submittedRankings: number;
  draftRankings: number;
}

export interface LGCRankingSummary {
  cycleId: ID;
  totals: LGCRankingSummaryTotals;
  tracks: {
    residency: LGCRankingSummaryTrackStats;
    fellowship: LGCRankingSummaryTrackStats;
  };
  universities: LGCRankingSummaryUniversity[];
}

/**
 * GET /api/dashboard/university/program-counts?cycle=<id>
 *
 * Per-program applicant status counts for the authenticated university's
 * programs in a specific cycle, plus the total unique applicants across
 * those programs. Draft applications are excluded server-side.
 */

export interface UniversityProgramStatusCounts {
  submitted: number;
  under_review: number;
  matched: number;
  unmatched: number;
  withdrawn: number;
  total: number;
}

export interface UniversityProgramCountsEntry {
  programId: ID;
  counts: UniversityProgramStatusCounts;
}

export interface UniversityProgramCounts {
  universityId: ID;
  cycleId: ID;
  totalUniqueApplicants: number;
  pendingReview: number;
  programs: UniversityProgramCountsEntry[];
}
