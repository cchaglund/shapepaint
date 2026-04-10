/* eslint-disable react-refresh/only-export-components -- Context exported for useToast hook */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { Notification } from '../types/notifications';

export interface Toast {
  id: string;
  notification: Notification;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (notification: Notification) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_TOASTS = 4;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((notification: Notification) => {
    const toast: Toast = { id: notification.id, notification };
    setToasts(prev => {
      const next = [...prev, toast];
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
    });
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
