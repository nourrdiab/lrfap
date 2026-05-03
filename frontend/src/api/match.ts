import { apiGet, apiPost } from './client';
import type {
  ID,
  MatchExecuteResponse,
  MatchPublishResponse,
  MatchRun,
  Track,
} from '../types';

/**
 * Backend routes live at `/api/match/*` and all require LGC role.
 *
 *   POST /dry-run   { cycleId, track } → MatchExecuteResponse
 *   POST /execute   { cycleId, track } → MatchExecuteResponse (persists)
 *   POST /publish   { cycleId, track } → MatchPublishResponse (flips cycle → published)
 *   GET  /runs                         → MatchRun[] (sorted -createdAt, populated)
 *   GET  /runs/:id                     → MatchRun (deep populate)
 *
 * There's no server-side filter on /runs, so callers that need a subset
 * (e.g. by cycle or track) filter client-side.
 */

export const matchApi = {
  dryRun: (cycleId: ID, track: Track) =>
    apiPost<MatchExecuteResponse>('/match/dry-run', { cycleId, track }),
  execute: (cycleId: ID, track: Track) =>
    apiPost<MatchExecuteResponse>('/match/execute', { cycleId, track }),
  publish: (cycleId: ID, track: Track) =>
    apiPost<MatchPublishResponse>('/match/publish', { cycleId, track }),
  listRuns: () => apiGet<MatchRun[]>('/match/runs'),
  getRun: (runId: ID) => apiGet<MatchRun>(`/match/runs/${runId}`),
};
