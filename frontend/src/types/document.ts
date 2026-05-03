import type { ID, ISODateString } from './common';

/**
 * Mirrors backend `models/Document.js`. Files are stored in Cloudflare R2;
 * `r2Key` is the storage key, never exposed as a direct URL — downloads
 * go through `GET /api/documents/:id/download` which returns a short-lived
 * signed URL.
 */

export type DocumentType =
  | 'transcript'
  | 'cv'
  | 'personal_statement'
  | 'degree_certificate'
  | 'recommendation_letter'
  | 'id_document'
  | 'medical_license'
  | 'language_test'
  | 'usmle_score'
  | 'other';

export type DocumentStatus =
  | 'pending'
  | 'verified'
  | 'rejected'
  | 'replacement_required';

export interface ApplicationDocument {
  _id: ID;
  owner: ID;
  application?: ID;
  type: DocumentType;
  r2Key: string;
  originalName: string;
  mimeType: string;
  size: number;
  status: DocumentStatus;
  reviewedBy?: ID;
  reviewedAt?: ISODateString;
  reviewNotes?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
