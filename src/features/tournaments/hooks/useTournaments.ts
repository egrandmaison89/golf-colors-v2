/**
 * useTournaments hook
 * 
 * Fetches and manages tournament list state
 */

import { useState, useEffect } from 'react';
import { getTournaments } from '../services/tournamentService';
import type { Tournament } from '../types';

interface UseTournamentsResult {
  tournaments: Tournament[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and manage tournaments
 */
export function useTournaments(): UseTournamentsResult {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTournaments = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTournaments();
      setTournaments(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch tournaments'));
      console.error('Error fetching tournaments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTournaments();
  }, []);

  return {
    tournaments,
    loading,
    error,
    refetch: fetchTournaments,
  };
}

