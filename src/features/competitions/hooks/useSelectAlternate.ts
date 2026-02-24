/**
 * useSelectAlternate hook
 *
 * Selects an alternate golfer (after draft completes)
 */

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { selectAlternate } from '../services/draftService';

interface UseSelectAlternateResult {
  select: (competitionId: string, golferId: string) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

export function useSelectAlternate(): UseSelectAlternateResult {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const select = async (competitionId: string, golferId: string) => {
    if (!user) {
      throw new Error('You must be logged in to select an alternate');
    }

    try {
      setLoading(true);
      setError(null);
      await selectAlternate(competitionId, user.id, golferId);
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Failed to select alternate');
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return {
    select,
    loading,
    error,
  };
}
