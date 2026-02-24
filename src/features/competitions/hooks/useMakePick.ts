/**
 * useMakePick hook
 *
 * Makes a draft pick for the current user
 */

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { makePick } from '../services/draftService';

interface UseMakePickResult {
  pick: (competitionId: string, golferId: string) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

export function useMakePick(): UseMakePickResult {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const pick = async (competitionId: string, golferId: string) => {
    if (!user) {
      throw new Error('You must be logged in to make a pick');
    }

    try {
      setLoading(true);
      setError(null);
      await makePick(competitionId, user.id, golferId);
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Failed to make pick');
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return {
    pick,
    loading,
    error,
  };
}
