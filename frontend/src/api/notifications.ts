import { apiGet, apiPatch } from './client';
import type { ID, Notification } from '../types';

// Backend wraps the list in `{ unreadCount, count, notifications }`.
// `list()` unwraps to just the array; `listWithMeta()` exposes the full
// wrapper so callers that also need the unread count (e.g. the
// NotificationsContext) can get it in one roundtrip.
export interface NotificationsListResponse {
  unreadCount: number;
  count: number;
  notifications: Notification[];
}

// Backend routes are PATCH, not POST (see routes/notificationRoutes.js).
// markAllRead's real response is `{ message, updated }`.
export const notificationsApi = {
  list: async (): Promise<Notification[]> => {
    const res = await apiGet<NotificationsListResponse>('/notifications');
    return res.notifications ?? [];
  },
  listWithMeta: () => apiGet<NotificationsListResponse>('/notifications'),
  markRead: (id: ID) => apiPatch<Notification>(`/notifications/${id}/read`),
  markAllRead: () =>
    apiPatch<{ message: string; updated: number }>('/notifications/read-all'),
};
