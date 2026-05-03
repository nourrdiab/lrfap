import type { ID, ISODateString } from './common';

// Mirrors the enum on backend models/Notification.js — do not invent
// values. Any unrecognized type falls through to a generic bell icon in
// the UI, so drift between client and server is harmless but wasted.
export type NotificationType =
  | 'application_submitted'
  | 'ranking_submitted'
  | 'match_published'
  | 'offer_received'
  | 'offer_expiring_soon'
  | 'system';

export interface Notification {
  _id: ID;
  user: ID;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  metadata?: Record<string, unknown>;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
