/**
 * useCompetitionLeaderboard hook
 *
 * Fetches calculated leaderboard for a competition.
 * Syncs tournament results from SportsData.io before scoring when tournament is active/completed.
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getCompetitionLeaderboard, syncTournamentResults } from '../services/scoringService';
import type { LeaderboardEntry } from '../services/scoringService';

interface UseCompetitionLeaderboardResult {
  leaderboard: LeaderboardEntry[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useCompetitionLeaderboard(competitionId: string): UseCompetitionLeaderboardResult {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchLeaderboard = async () => {
    if (!competitionId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch tournament info to decide whether to sync results
      const { data: competition } = await supabase
        .from('competitions')
        .select('tournament_id, tournaments(sportsdata_id, status)')
        .eq('id', competitionId)
        .single();

      if (competition) {
        const raw = competition as unknown as {
          tournament_id: string;
          tournaments?:
            | { sportsdata_id: string; status: string }
            | { sportsdata_id: string; status: string }[];
        };
        const t = Array.isArray(raw.tournaments) ? raw.tournaments[0] : raw.tournaments;
        // Sync when tournament is active or completed (has live/final scores)
        if (t && (t.status === 'active' || t.status === 'completed')) {
          await syncTournamentResults(raw.tournament_id, t.sportsdata_id);
        }
      }

      const data = await getCompetitionLeaderboard(competitionId);
      setLeaderboard(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch leaderboard'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [competitionId]);

  return {
    leaderboard,
    loading,
    error,
    refetch: fetchLeaderboard,
  };
}
