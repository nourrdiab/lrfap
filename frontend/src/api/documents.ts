import { apiClient, apiDelete, apiGet, apiPatch } from './client';
import type {
  ApplicationDocument,
  DocumentStatus,
  DocumentType,
  ID,
} from '../types';

export interface UploadDocumentPayload {
  file: File;
  type: DocumentType;
  applicationId?: ID;
  onUploadProgress?: (percent: number) => void;
}

export interface ReviewDocumentPayload {
  status: DocumentStatus;
  reviewNotes?: string;
}

/**
 * Backend routes live under `/api/documents`:
 *   POST   /                           upload (multipart: file, type, applicationId)
 *   GET    /                           list mine
 *   GET    /application/:applicationId list for an application
 *   GET    /:id/download               signed URL
 *   DELETE /:id
 *   PATCH  /:id/status                 review (university/LGC only)
 */
export const documentsApi = {
  list: () => apiGet<ApplicationDocument[]>('/documents'),

  listForApplication: (applicationId: ID) =>
    apiGet<ApplicationDocument[]>(`/documents/application/${applicationId}`),

  upload: async ({
    file,
    type,
    applicationId,
    onUploadProgress,
  }: UploadDocumentPayload) => {
    const form = new FormData();
    form.append('file', file);
    form.append('type', type);
    if (applicationId) form.append('applicationId', applicationId);
    // Backend returns `{ message, document }` on 201; unwrap to just the doc.
    const res = await apiClient.post<{ message: string; document: ApplicationDocument }>(
      '/documents',
      form,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          if (onUploadProgress && evt.total) {
            onUploadProgress(Math.round((evt.loaded / evt.total) * 100));
          }
        },
      },
    );
    return res.data.document;
  },

  getDownloadUrl: (id: ID) =>
    apiGet<{ url: string; expiresAt?: string }>(`/documents/${id}/download`),

  getViewUrl: (id: ID) =>
    apiGet<{ url: string; expiresAt?: string }>(`/documents/${id}/view`),

  remove: (id: ID) => apiDelete<{ success: boolean }>(`/documents/${id}`),

  review: (id: ID, body: ReviewDocumentPayload) =>
    apiPatch<ApplicationDocument>(`/documents/${id}/status`, body),
};
