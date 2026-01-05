/**
 * useCreateCompetition hook
 * 
 * Handles competition creation
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { createCompetition } from '../services/competitionService';

interface UseCreateCompetitionResult {
  create: (tournamentId: string, name: string) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to create a new competition
 */
export function useCreateCompetition(): UseCreateCompetitionResult {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const create = async (tournamentId: string, name: string) => {
    if (!user) {
      throw new Error('You must be logged in to create a competition');
    }

    try {
      setLoading(true);
      setError(null);
      const competition = await createCompetition(tournamentId, name, user.id);
      navigate(`/competitions/${competition.id}`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create competition');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    create,
    loading,
    error,
  };
}

