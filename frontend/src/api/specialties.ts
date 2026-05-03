import { apiDelete, apiGet, apiPost, apiPut } from './client';
import type { ID, Specialty } from '../types';

export const specialtiesApi = {
  list: () => apiGet<Specialty[]>('/specialties'),
  get: (id: ID) => apiGet<Specialty>(`/specialties/${id}`),
  create: (body: Omit<Specialty, '_id'>) => apiPost<Specialty>('/specialties', body),
  update: (id: ID, body: Partial<Specialty>) =>
    apiPut<Specialty>(`/specialties/${id}`, body),
  remove: (id: ID) => apiDelete<{ success: boolean }>(`/specialties/${id}`),
};
