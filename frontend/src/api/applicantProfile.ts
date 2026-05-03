import { apiGet, apiPut } from './client';
import type { ApplicantProfile } from '../types';

export const applicantProfileApi = {
  getMe: () => apiGet<ApplicantProfile>('/applicant-profile/me'),
  updateMe: (body: Partial<ApplicantProfile>) =>
    apiPut<ApplicantProfile>('/applicant-profile/me', body),
};
