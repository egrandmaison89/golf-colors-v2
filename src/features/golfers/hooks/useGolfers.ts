/**
 * useGolfers hook
 * 
 * Fetches and manages golfer list state
 */

import { useState, useEffect } from 'react';
import { getGolfersList } from '../services/golferService';
import type { Golfer } from '../types';

interface UseGolfersResult {
  golfers: Golfer[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and manage golfers
 */
export function useGolfers(): UseGolfersResult {
  const [golfers, setGolfers] = useState<Golfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchGolfers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getGolfersList();
      setGolfers(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch golfers'));
      console.error('Error fetching golfers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGolfers();
  }, []);

  return {
    golfers,
    loading,
    error,
    refetch: fetchGolfers,
  };
}

