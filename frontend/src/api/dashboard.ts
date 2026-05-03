import { apiGet } from './client';
import type {
  ApplicantDashboard,
  ID,
  LGCDashboard,
  LGCRankingSummary,
  UniversityProgramCounts,
} from '../types';

export const dashboardApi = {
  applicant: () => apiGet<ApplicantDashboard>('/dashboard/applicant'),
  lgc: () => apiGet<LGCDashboard>('/dashboard/lgc'),
  /**
   * LGC ranking summary — single aggregation that replaces the old
   * per-program ranking fetch loop. `cycleId` is required server-side.
   */
  lgcRankingSummary: (cycleId: ID) =>
    apiGet<LGCRankingSummary>('/dashboard/lgc/ranking-summary', {
      params: { cycle: cycleId },
    }),
  /**
   * Per-program applicant counts + unique applicants for the caller's
   * university, scoped to a specific cycle.
   */
  universityProgramCounts: (cycleId: ID) =>
    apiGet<UniversityProgramCounts>('/dashboard/university/program-counts', {
      params: { cycle: cycleId },
    }),
};
