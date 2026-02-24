/**
 * useDraftOrder hook
 *
 * Fetches draft order for a competition
 */

import { useState, useEffect } from 'react';
import { getDraftOrder } from '../services/draftService';
import type { DraftOrderWithUser } from '../services/draftService';

interface UseDraftOrderResult {
  draftOrder: DraftOrderWithUser[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useDraftOrder(competitionId: string): UseDraftOrderResult {
  const [draftOrder, setDraftOrder] = useState<DraftOrderWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrder = async () => {
    if (!competitionId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getDraftOrder(competitionId);
      setDraftOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch draft order'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [competitionId]);

  return {
    draftOrder,
    loading,
    error,
    refetch: fetchOrder,
  };
}
