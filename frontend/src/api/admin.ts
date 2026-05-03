import { apiPost } from './client';
import type { ID } from '../types';

/**
 * TODO: Remove this module before production deployment.
 * Dev/demo reset utility only.
 */

export interface ResetCycleResponse {
  applicationsReset: number;
  matchRunsDeleted: number;
  rankingsDeleted: number;
  programsReset: number;
  cycleStatusReset: boolean;
  message: string;
}

export interface BulkSubmitRankingsResponse {
  programsProcessed: number;
  rankingsCreated: number;
  rankingsSubmitted: number;
  message: string;
}

export const adminApi = {
  resetCycle: (cycleId: ID) =>
    apiPost<ResetCycleResponse>(`/admin/reset-cycle/${cycleId}`),
  bulkSubmitRankings: (cycleId: ID) =>
    apiPost<BulkSubmitRankingsResponse>(
      `/admin/bulk-submit-rankings/${cycleId}`,
    ),
};
