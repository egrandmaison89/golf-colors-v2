/**
 * useDraftPicks hook
 *
 * Fetches draft picks for a competition
 */

import { useState, useEffect } from 'react';
import { getDraftPicks } from '../services/draftService';
import type { DraftPickWithGolfer } from '../services/draftService';

interface UseDraftPicksResult {
  draftPicks: DraftPickWithGolfer[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useDraftPicks(competitionId: string): UseDraftPicksResult {
  const [draftPicks, setDraftPicks] = useState<DraftPickWithGolfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPicks = async () => {
    if (!competitionId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getDraftPicks(competitionId);
      setDraftPicks(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch draft picks'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPicks();
  }, [competitionId]);

  return {
    draftPicks,
    loading,
    error,
    refetch: fetchPicks,
  };
}
