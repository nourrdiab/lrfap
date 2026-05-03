import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './client';
import type { Cycle, CycleStatus, ID } from '../types';

export const cyclesApi = {
  list: () => apiGet<Cycle[]>('/cycles'),
  get: (id: ID) => apiGet<Cycle>(`/cycles/${id}`),
  create: (body: Omit<Cycle, '_id'>) => apiPost<Cycle>('/cycles', body),
  update: (id: ID, body: Partial<Cycle>) => apiPut<Cycle>(`/cycles/${id}`, body),
  setStatus: (id: ID, status: CycleStatus) =>
    apiPatch<Cycle>(`/cycles/${id}/status`, { status }),
  remove: (id: ID) => apiDelete<{ success: boolean }>(`/cycles/${id}`),
};
