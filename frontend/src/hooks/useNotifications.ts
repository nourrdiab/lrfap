import { useContext } from 'react';
import {
  NotificationsContext,
  type NotificationsContextValue,
} from '../context/NotificationsContext';

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error(
      'useNotifications must be used inside a <NotificationsProvider>',
    );
  }
  return ctx;
}
