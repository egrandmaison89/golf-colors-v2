/**
 * useGolfer hook
 * 
 * Fetches and manages a single golfer state
 */

import { useState, useEffect } from 'react';
import { getGolfer } from '../services/golferService';
import type { Golfer } from '../types';

interface UseGolferResult {
  golfer: Golfer | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and manage a single golfer
 */
export function useGolfer(id: string): UseGolferResult {
  const [golfer, setGolfer] = useState<Golfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchGolfer = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getGolfer(id);
      setGolfer(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch golfer'));
      console.error('Error fetching golfer:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchGolfer();
    }
  }, [id]);

  return {
    golfer,
    loading,
    error,
    refetch: fetchGolfer,
  };
}

