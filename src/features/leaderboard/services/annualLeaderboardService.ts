/**
 * Annual Leaderboard Service
 *
 * Fetches year-over-year rankings from annual_leaderboard table
 */

import { supabase } from '@/lib/supabase/client';

export interface AnnualLeaderboardEntry {
  id: string;
  user_id: string;
  year: number;
  total_competitions: number;
  competitions_won: number;
  total_winnings: number;
}

/**
 * Get annual leaderboard for a given year
 */
export async function getAnnualLeaderboard(year: number): Promise<AnnualLeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('annual_leaderboard')
    .select('*')
    .eq('year', year)
    .order('total_winnings', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch annual leaderboard: ${error.message}`);
  }

  return (data as AnnualLeaderboardEntry[]) || [];
}
