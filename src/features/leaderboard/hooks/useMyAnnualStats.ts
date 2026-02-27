/**
 * useMyAnnualStats hook
 *
 * Fetches the current user's annual stats from the annual_leaderboard table
 * for use in the Dashboard summary card.
 */

import { useState, useEffect } from 'react';
import { getMyAnnualStats } from '../services/annualLeaderboardService';
import type { MyAnnualStats } from '../services/annualLeaderboardService';

interface UseMyAnnualStatsResult {
  stats: MyAnnualStats | null;
  loading: boolean;
  error: Error | null;
}

export function useMyAnnualStats(userId: string | undefined, year: number): UseMyAnnualStatsResult {
  const [stats, setStats] = useState<MyAnnualStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetch() {
      try {
        setLoading(true);
        setError(null);
        const data = await getMyAnnualStats(userId!, year);
        if (!cancelled) setStats(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed to fetch annual stats'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, [userId, year]);

  return { stats, loading, error };
}
