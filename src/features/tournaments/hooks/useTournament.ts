/**
 * useTournament hook
 * 
 * Fetches and manages a single tournament state
 */

import { useState, useEffect } from 'react';
import { getTournament } from '../services/tournamentService';
import type { Tournament } from '../types';

interface UseTournamentResult {
  tournament: Tournament | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and manage a single tournament
 */
export function useTournament(id: string): UseTournamentResult {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTournament = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTournament(id);
      setTournament(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch tournament'));
      console.error('Error fetching tournament:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchTournament();
    }
  }, [id]);

  return {
    tournament,
    loading,
    error,
    refetch: fetchTournament,
  };
}

