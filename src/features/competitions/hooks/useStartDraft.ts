/**
 * useStartDraft hook
 *
 * Starts the draft for a competition (creator only)
 */

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { startDraft } from '../services/draftService';

interface UseStartDraftResult {
  start: (competitionId: string) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

export function useStartDraft(): UseStartDraftResult {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const start = async (competitionId: string) => {
    if (!user) {
      throw new Error('You must be logged in to start a draft');
    }

    try {
      setLoading(true);
      setError(null);
      await startDraft(competitionId, user.id);
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Failed to start draft');
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return {
    start,
    loading,
    error,
  };
}
