/**
 * useCompetition hook
 * 
 * Fetches and manages a single competition
 */

import { useState, useEffect } from 'react';
import { getCompetitionById } from '../services/competitionService';
import type { CompetitionWithDetails } from '../types';

interface UseCompetitionResult {
  competition: CompetitionWithDetails | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and manage a single competition
 */
export function useCompetition(id: string): UseCompetitionResult {
  const [competition, setCompetition] = useState<CompetitionWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCompetition = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCompetitionById(id);
      setCompetition(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch competition'));
      console.error('Error fetching competition:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchCompetition();
    }
  }, [id]);

  return {
    competition,
    loading,
    error,
    refetch: fetchCompetition,
  };
}

