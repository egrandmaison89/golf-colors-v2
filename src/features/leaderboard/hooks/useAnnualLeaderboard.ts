/**
 * useAnnualLeaderboard hook
 *
 * Fetches annual leaderboard for a given year
 */

import { useState, useEffect } from 'react';
import { getAnnualLeaderboard } from '../services/annualLeaderboardService';
import type { AnnualLeaderboardEntry } from '../services/annualLeaderboardService';

interface UseAnnualLeaderboardResult {
  entries: AnnualLeaderboardEntry[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useAnnualLeaderboard(year: number): UseAnnualLeaderboardResult {
  const [entries, setEntries] = useState<AnnualLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAnnualLeaderboard(year);
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch leaderboard'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [year]);

  return {
    entries,
    loading,
    error,
    refetch: fetchLeaderboard,
  };
}
