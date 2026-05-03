import { apiPost } from './client';
import type { AuthResponse, User, UserRole } from '../types';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterApplicantPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  role: Exclude<UserRole, 'applicant'>;
  firstName?: string;
  lastName?: string;
  university?: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
}

export const authApi = {
  login: (body: LoginPayload) => apiPost<AuthResponse>('/auth/login', body),
  register: (body: RegisterApplicantPayload) =>
    apiPost<AuthResponse>('/auth/register', body),
  logout: () => apiPost<{ success: boolean }>('/auth/logout'),
  refresh: () => apiPost<{ accessToken: string }>('/auth/refresh'),
  forgotPassword: (body: ForgotPasswordPayload) =>
    apiPost<{ success: boolean }>('/auth/forgot-password', body),
  resetPassword: (body: ResetPasswordPayload) =>
    apiPost<{ success: boolean }>('/auth/reset-password', body),
  createUser: (body: CreateUserPayload) => apiPost<User>('/auth/users', body),
};
