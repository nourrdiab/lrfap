import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { notificationsApi } from '../api/notifications';
import type { ID } from '../types';

/**
 * App-wide notification state. Mounted at ApplicantLayout so the navbar
 * bell badge, the NotificationsPage, and any future surface share one
 * source of truth for the unread count.
 *
 * Scope on purpose is narrow: this context owns the *count* and the
 * action wrappers that mutate it. Pages that render the list own their
 * own list state and call these actions to keep the count in sync —
 * we don't duplicate the notification list in memory.
 */

export interface NotificationsContextValue {
  unreadCount: number;
  /** POST mark-read for a single notification and decrement the badge. */
  markRead: (id: ID) => Promise<void>;
  /** POST mark-all-read and zero the badge. */
  markAllRead: () => Promise<void>;
  /** Re-fetch the wrapper to resync the count (no re-render of lists). */
  refresh: () => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const NotificationsContext =
  createContext<NotificationsContextValue | null>(null);

interface NotificationsProviderProps {
  children: ReactNode;
}

export function NotificationsProvider({ children }: NotificationsProviderProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  // Guard against double-fetch in React strict-mode dev. One fetch per
  // provider mount is enough — no polling yet.
  const fetchedRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const res = await notificationsApi.listWithMeta();
      setUnreadCount(res.unreadCount ?? 0);
    } catch {
      // Silent — the bell already renders sensibly at zero. The full
      // NotificationsPage surfaces fetch errors to the user via its own
      // error banner.
    }
  }, []);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    void refresh();
  }, [refresh]);

  const markRead = useCallback(async (id: ID) => {
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await notificationsApi.markRead(id);
    } catch (err) {
      setUnreadCount((c) => c + 1);
      throw err;
    }
  }, []);

  const markAllRead = useCallback(async () => {
    let prev = 0;
    setUnreadCount((c) => {
      prev = c;
      return 0;
    });
    try {
      await notificationsApi.markAllRead();
    } catch (err) {
      setUnreadCount(prev);
      throw err;
    }
  }, []);

  const value: NotificationsContextValue = {
    unreadCount,
    markRead,
    markAllRead,
    refresh,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}
