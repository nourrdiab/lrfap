import { apiGet } from './client';
import type { AuditActorRole, AuditLogListResponse } from '../types';

export interface AuditFilters {
  action?: string;
  actorRole?: AuditActorRole;
  targetType?: string;
  limit?: number;
  skip?: number;
}

export const auditApi = {
  list: (filters?: AuditFilters) =>
    apiGet<AuditLogListResponse>('/audit', { params: filters }),
};
