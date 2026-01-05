/**
 * useCompetitions hook
 * 
 * Fetches and manages user's competitions
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getCompetitions } from '../services/competitionService';
import type { CompetitionWithDetails } from '../types';

interface UseCompetitionsResult {
  competitions: CompetitionWithDetails[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and manage user's competitions
 */
export function useCompetitions(): UseCompetitionsResult {
  const { user } = useAuth();
  const [competitions, setCompetitions] = useState<CompetitionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCompetitions = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getCompetitions(user.id);
      setCompetitions(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch competitions'));
      console.error('Error fetching competitions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompetitions();
  }, [user]);

  return {
    competitions,
    loading,
    error,
    refetch: fetchCompetitions,
  };
}

