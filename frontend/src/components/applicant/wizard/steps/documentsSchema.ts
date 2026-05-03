import type { DocumentType } from '../../../../types';

/**
 * The 9 required document types per Figma Dashboard 1, each mapped to its
 * backend `type` enum value (verified against `models/Document.js`).
 *
 * Per the current LRFAP cycle every type is treated as required. If a
 * future cycle needs a per-cycle "required" flag we can flip these to
 * optional and read from a backend-driven list, but there's no such
 * endpoint today.
 */

export interface DocumentTypeDef {
  type: DocumentType;
  label: string;
  description: string;
  required: boolean;
}

export const DOCUMENT_TYPES: readonly DocumentTypeDef[] = [
  {
    type: 'cv',
    label: 'CV / Resume',
    description: 'Upload your current CV or resume',
    required: true,
  },
  {
    type: 'personal_statement',
    label: 'Personal Statement',
    description: 'Your motivation and career plans',
    required: true,
  },
  {
    type: 'transcript',
    label: 'Transcript',
    description: 'Official academic transcript',
    required: true,
  },
  {
    type: 'degree_certificate',
    label: 'Degree Certification',
    description: 'Medical degree certificate',
    required: true,
  },
  {
    type: 'recommendation_letter',
    label: 'Recommendation Letters',
    description: 'Letters from supervisors or faculty',
    required: true,
  },
  {
    type: 'id_document',
    label: 'ID / Passport',
    description: 'Government-issued photo ID',
    required: true,
  },
  {
    type: 'medical_license',
    label: 'License / Registration',
    description: 'Medical license or registration proof',
    required: true,
  },
  {
    type: 'language_test',
    label: 'Language Test',
    description: 'Language proficiency test results',
    required: true,
  },
  {
    type: 'other',
    label: 'Additional Institution-Specific Documents',
    description: 'Any supporting documents requested by programs',
    required: true,
  },
] as const;

export const ALLOWED_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
];

export const ALLOWED_UPLOAD_ACCEPT = '.pdf,.jpg,.jpeg,.png';
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
