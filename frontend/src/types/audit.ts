import type { ID, ISODateString } from './common';
import type { User } from './user';

export type AuditOutcome = 'success' | 'failure';

export type AuditActorRole = 'applicant' | 'university' | 'lgc' | 'system';

export interface AuditLog {
  _id: ID;
  actor: ID | User;
  actorRole: AuditActorRole;
  action: string;
  targetType?: string;
  targetId?: ID;
  outcome: AuditOutcome;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: ISODateString;
  updatedAt?: ISODateString;
}

export interface AuditLogListResponse {
  total: number;
  count: number;
  logs: AuditLog[];
}
