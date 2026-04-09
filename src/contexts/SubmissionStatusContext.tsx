/* eslint-disable react-refresh/only-export-components -- Context exported for useSubmissionStatus hook */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { checkSubmissionExists } from '../lib/api';

interface SubmissionStatusContextValue {
  /** Whether the current user has submitted art today */
  hasSubmittedToday: boolean;
  /** Whether the initial check has completed */
  hasCheckedSubmission: boolean;
  /** Call after a successful save to update the shared state */
  markAsSubmitted: () => void;
}

const SubmissionStatusContext = createContext<SubmissionStatusContextValue | null>(null);

interface SubmissionStatusProviderProps {
  userId: string | undefined;
  todayDate: string;
  children: ReactNode;
}

export function SubmissionStatusProvider({ userId, todayDate, children }: SubmissionStatusProviderProps) {
  const [hasSubmittedToday, setHasSubmittedToday] = useState(false);
  const [hasCheckedSubmission, setHasCheckedSubmission] = useState(false);
  const checkedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) {
      // Logged-out users can never have submitted
      checkedForRef.current = null;
      setHasSubmittedToday(false); // eslint-disable-line -- intentional sync reset for logged-out state
      setHasCheckedSubmission(true);
      return;
    }

    const key = `${userId}-${todayDate}`;
    if (checkedForRef.current === key) return;
    checkedForRef.current = key;

    let cancelled = false;
    const check = async () => {
      const exists = await checkSubmissionExists(userId, todayDate);
      if (!cancelled) {
        setHasSubmittedToday(exists);
        setHasCheckedSubmission(true);
      }
    };
    check();
    return () => { cancelled = true; };
  }, [userId, todayDate]);

  const markAsSubmitted = useCallback(() => {
    setHasSubmittedToday(true);
  }, []);

  return (
    <SubmissionStatusContext.Provider value={{ hasSubmittedToday, hasCheckedSubmission, markAsSubmitted }}>
      {children}
    </SubmissionStatusContext.Provider>
  );
}

export function useSubmissionStatus(): SubmissionStatusContextValue {
  const context = useContext(SubmissionStatusContext);
  if (!context) {
    throw new Error('useSubmissionStatus must be used within a SubmissionStatusProvider');
  }
  return context;
}
