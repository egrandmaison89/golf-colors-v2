/**
 * useCurrentTurn hook
 *
 * Returns whose turn it is for the next pick
 */

import { useState, useEffect } from 'react';
import { getCurrentTurn } from '../services/draftService';

interface UseCurrentTurnResult {
  currentTurnUserId: string | null;
  pickNumber: number;
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useCurrentTurn(competitionId: string): UseCurrentTurnResult {
  const [currentTurnUserId, setCurrentTurnUserId] = useState<string | null>(null);
  const [pickNumber, setPickNumber] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchTurn = async () => {
    if (!competitionId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { userId, pickNumber: num } = await getCurrentTurn(competitionId);
      setCurrentTurnUserId(userId);
      setPickNumber(num);
    } catch {
      setCurrentTurnUserId(null);
      setPickNumber(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTurn();
  }, [competitionId]);

  return {
    currentTurnUserId,
    pickNumber,
    loading,
    refetch: fetchTurn,
  };
}
