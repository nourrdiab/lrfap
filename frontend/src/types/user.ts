import type { ID, ISODateString } from './common';

export type UserRole = 'applicant' | 'university' | 'lgc';

export interface User {
  _id: ID;
  email: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  universityId?: ID;
  createdAt?: ISODateString;
  updatedAt?: ISODateString;
  isFirstLogin?: boolean;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}
