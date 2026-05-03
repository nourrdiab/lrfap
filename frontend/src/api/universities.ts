import { apiDelete, apiGet, apiPost, apiPut } from './client';
import type { ID, University } from '../types';

export const universitiesApi = {
  list: () => apiGet<University[]>('/universities'),
  get: (id: ID) => apiGet<University>(`/universities/${id}`),
  create: (body: Omit<University, '_id'>) => apiPost<University>('/universities', body),
  update: (id: ID, body: Partial<University>) =>
    apiPut<University>(`/universities/${id}`, body),
  remove: (id: ID) => apiDelete<{ success: boolean }>(`/universities/${id}`),
};
