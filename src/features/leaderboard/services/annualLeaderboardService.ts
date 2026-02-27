/**
 * Annual Leaderboard Service
 *
 * Fetches year-over-year rankings from annual_leaderboard table,
 * joined with user_profiles for display names and team colors.
 */

import { supabase } from '@/lib/supabase/client';

export interface AnnualLeaderboardEntry {
  id: string;
  user_id: string;
  year: number;
  total_competitions: number;
  competitions_won: number;
  total_winnings: number;
  total_bounties: number;
  display_name: string | null;
  team_color: string | null;
}

export interface MyAnnualStats {
  year: number;
  total_competitions: number;
  competitions_won: number;
  total_winnings: number;
  total_bounties: number;
}

/**
 * Get annual leaderboard for a given year, sorted by total net earnings (winnings + bounties).
 * Uses a two-step query because there is no FK from annual_leaderboard.user_id to
 * user_profiles.id for Supabase embedded joins.
 */
export async function getAnnualLeaderboard(year: number): Promise<AnnualLeaderboardEntry[]> {
  // Step 1: fetch leaderboard rows
  const { data, error } = await supabase
    .from('annual_leaderboard')
    .select('id, user_id, year, total_competitions, competitions_won, total_winnings, total_bounties')
    .eq('year', year);

  if (error) {
    throw new Error(`Failed to fetch annual leaderboard: ${error.message}`);
  }

  if (!data || data.length === 0) return [];

  // Step 2: fetch user profiles for those users
  const userIds = data.map((row) => row.user_id);
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, display_name, team_color')
    .in('id', userIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  // Step 3: merge and sort
  const entries: AnnualLeaderboardEntry[] = data.map((row) => {
    const profile = profileMap.get(row.user_id);
    return {
      id: row.id,
      user_id: row.user_id,
      year: row.year,
      total_competitions: row.total_competitions,
      competitions_won: row.competitions_won,
      total_winnings: row.total_winnings ?? 0,
      total_bounties: row.total_bounties ?? 0,
      display_name: profile?.display_name ?? null,
      team_color: profile?.team_color ?? null,
    };
  });

  entries.sort(
    (a, b) =>
      (b.total_winnings + b.total_bounties) - (a.total_winnings + a.total_bounties)
  );

  return entries;
}

/**
 * Get annual stats for the current logged-in user (for the dashboard summary card).
 * Returns null if no data exists for this user/year.
 */
export async function getMyAnnualStats(
  userId: string,
  year: number
): Promise<MyAnnualStats | null> {
  const { data, error } = await supabase
    .from('annual_leaderboard')
    .select('year, total_competitions, competitions_won, total_winnings, total_bounties')
    .eq('user_id', userId)
    .eq('year', year)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch annual stats: ${error.message}`);
  }

  if (!data) return null;

  return {
    year: data.year,
    total_competitions: data.total_competitions,
    competitions_won: data.competitions_won,
    total_winnings: data.total_winnings ?? 0,
    total_bounties: data.total_bounties ?? 0,
  };
}
