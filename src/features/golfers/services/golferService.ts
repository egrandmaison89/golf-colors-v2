/**
 * Golfer Service
 *
 * Handles golfer data fetching with multi-layer caching:
 * 1. Check Supabase cache
 * 2. Determine if refresh needed (based on staleness)
 * 3. Fetch from SportsData.io API if needed
 * 4. Update Supabase cache
 * 5. Return data
 *
 * Also handles tournament-specific player fields via the tournament_golfers table.
 * The tournament field is populated from /Leaderboard/{tournamentSportsdataId} which
 * returns the actual players entered in that tournament along with their odds.
 */

import { supabase } from '@/lib/supabase/client';
import { getGolfers, getGolfer as getGolferFromAPI, getTournamentLeaderboard } from '@/lib/api/sportsdata';
import { trackAPICall } from '@/lib/utils/apiTracking';
import { GOLFER_REFRESH_INTERVAL } from '@/lib/constants/cache';
import { isStale } from '@/lib/utils/cache';
import type { Golfer, SportsDataGolfer } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface TournamentGolferEntry {
  golfer_id: string;
  sportsdata_player_id: string;
  display_name: string;
  odds_to_win: number | null;
  is_alternate: boolean;
  tournament_status: string | null;
  country: string | null;
  world_ranking: number | null;
  headshot_url: string | null;
}

// ============================================================================
// All golfers (global cache — used as fallback)
// ============================================================================

function transformGolfer(apiGolfer: SportsDataGolfer): Omit<Golfer, 'id' | 'created_at' | 'last_updated'> {
  return {
    sportsdata_id: apiGolfer.PlayerID.toString(),
    first_name: apiGolfer.FirstName,
    last_name: apiGolfer.LastName,
    display_name: `${apiGolfer.FirstName} ${apiGolfer.LastName}`,
    headshot_url: null,
    country: apiGolfer.Country || null,
    world_ranking: apiGolfer.WorldRanking || null,
  };
}

/**
 * Get all golfers (global cache, fallback when tournament field unavailable)
 */
export async function getGolfersList(): Promise<Golfer[]> {
  const { data: cachedGolfers, error: fetchError } = await supabase
    .from('golfers')
    .select('*')
    .order('world_ranking', { ascending: true, nullsFirst: false });

  if (fetchError) {
    console.error('Error fetching golfers from cache:', fetchError);
  }

  const needsRefresh = !cachedGolfers || cachedGolfers.length === 0 ||
    cachedGolfers.some(golfer => isStale(golfer.last_updated, GOLFER_REFRESH_INTERVAL));

  if (!needsRefresh && cachedGolfers) {
    return cachedGolfers;
  }

  try {
    const apiGolfers = await getGolfers() as SportsDataGolfer[];
    await trackAPICall('/Players', 'golfer');

    const golfersToUpsert = apiGolfers.map((apiGolfer) => ({
      ...transformGolfer(apiGolfer),
      last_updated: new Date().toISOString(),
    }));

    const { data: updatedGolfers, error: upsertError } = await supabase
      .from('golfers')
      .upsert(golfersToUpsert, { onConflict: 'sportsdata_id', ignoreDuplicates: false })
      .select()
      .order('world_ranking', { ascending: true, nullsFirst: false });

    if (upsertError) {
      console.error('Error upserting golfers:', upsertError);
      return cachedGolfers || [];
    }

    return updatedGolfers || [];
  } catch (error) {
    console.error('Error fetching golfers from API:', error);
    return cachedGolfers || [];
  }
}

// ============================================================================
// Tournament-specific player field
// ============================================================================

const FIELD_REFRESH_MS = 12 * 60 * 60 * 1000; // 12 hours

/**
 * Sync the tournament player field from SportsData.io /Leaderboard endpoint.
 *
 * Fetches the actual entrants for the tournament (not the full global player list).
 * Populates golfers + tournament_golfers tables.
 * Idempotent: skips if data is fresh (< 12 hours old).
 */
export async function syncTournamentField(
  tournamentId: string,
  tournamentSportsdataId: string
): Promise<void> {
  // Check for fresh cached field
  const { data: existing } = await supabase
    .from('tournament_golfers')
    .select('last_updated')
    .eq('tournament_id', tournamentId)
    .limit(1)
    .single();

  if (existing && !isStale(existing.last_updated, FIELD_REFRESH_MS)) {
    return; // Already fresh, skip
  }

  try {
    const leaderboard = await getTournamentLeaderboard(tournamentSportsdataId) as {
      Players?: Array<{
        PlayerID: number;
        Name: string;
        OddsToWin: number | null;
        IsAlternate: boolean;
        TournamentStatus: string | null;
      }>;
    };

    const players = leaderboard?.Players;
    if (!players || players.length === 0) return;

    // 1. Upsert players into golfers table (sportsdata_id is the conflict key)
    const golferUpserts = players.map((p) => {
      const parts = p.Name.split(' ');
      const firstName = parts[0] ?? '';
      const lastName = parts.slice(1).join(' ') || '';
      return {
        sportsdata_id: p.PlayerID.toString(),
        first_name: firstName,
        last_name: lastName,
        display_name: p.Name,
        headshot_url: null as string | null,
        country: null as string | null,
        world_ranking: null as number | null,
        last_updated: new Date().toISOString(),
      };
    });

    for (let i = 0; i < golferUpserts.length; i += 50) {
      const batch = golferUpserts.slice(i, i + 50);
      const { error } = await supabase
        .from('golfers')
        .upsert(batch, { onConflict: 'sportsdata_id', ignoreDuplicates: false });
      if (error) console.error('Golfer upsert error:', error);
    }

    // 2. Fetch internal golfer IDs for these sportsdata_ids
    const sportsdataIds = players.map((p) => p.PlayerID.toString());
    const { data: golferRows } = await supabase
      .from('golfers')
      .select('id, sportsdata_id')
      .in('sportsdata_id', sportsdataIds);

    if (!golferRows || golferRows.length === 0) return;

    const sdIdToGolferId = new Map(golferRows.map((g) => [g.sportsdata_id, g.id]));

    // 3. Upsert tournament_golfers rows
    const now = new Date().toISOString();
    const fieldEntries = players
      .map((p) => {
        const golferId = sdIdToGolferId.get(p.PlayerID.toString());
        if (!golferId) return null;
        return {
          tournament_id: tournamentId,
          golfer_id: golferId,
          sportsdata_player_id: p.PlayerID.toString(),
          odds_to_win: p.OddsToWin ?? null,
          is_alternate: p.IsAlternate ?? false,
          tournament_status: p.TournamentStatus ?? null,
          last_updated: now,
        };
      })
      .filter(Boolean) as Array<{
        tournament_id: string;
        golfer_id: string;
        sportsdata_player_id: string;
        odds_to_win: number | null;
        is_alternate: boolean;
        tournament_status: string | null;
        last_updated: string;
      }>;

    for (let i = 0; i < fieldEntries.length; i += 50) {
      const batch = fieldEntries.slice(i, i + 50);
      const { error } = await supabase
        .from('tournament_golfers')
        .upsert(batch, { onConflict: 'tournament_id,golfer_id', ignoreDuplicates: false });
      if (error) console.error('tournament_golfers upsert error:', error);
    }

    await trackAPICall(`/Leaderboard/${tournamentSportsdataId}`, 'tournament_field');
  } catch (err) {
    console.error('syncTournamentField error:', err);
  }
}

/**
 * Get golfers in a tournament's actual field, joined with golfer info.
 * Returns sorted by odds (favorites first), alternates excluded by default.
 */
export async function getTournamentField(
  tournamentId: string,
  includeAlternates = false
): Promise<TournamentGolferEntry[]> {
  let query = supabase
    .from('tournament_golfers')
    .select(`
      golfer_id,
      sportsdata_player_id,
      odds_to_win,
      is_alternate,
      tournament_status,
      golfers (
        display_name,
        country,
        world_ranking,
        headshot_url
      )
    `)
    .eq('tournament_id', tournamentId);

  if (!includeAlternates) {
    query = query.eq('is_alternate', false);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error('getTournamentField error:', error);
    return [];
  }

  return data
    .map((row) => {
      const golfer = Array.isArray(row.golfers) ? row.golfers[0] : row.golfers;
      return {
        golfer_id: row.golfer_id,
        sportsdata_player_id: row.sportsdata_player_id,
        display_name: (golfer as { display_name?: string })?.display_name ?? 'Unknown',
        odds_to_win: row.odds_to_win,
        is_alternate: row.is_alternate,
        tournament_status: row.tournament_status,
        country: (golfer as { country?: string | null })?.country ?? null,
        world_ranking: (golfer as { world_ranking?: number | null })?.world_ranking ?? null,
        headshot_url: (golfer as { headshot_url?: string | null })?.headshot_url ?? null,
      } as TournamentGolferEntry;
    })
    .sort((a, b) => {
      // Favorites (low odds) first, nulls last
      if (a.odds_to_win === null && b.odds_to_win === null) return 0;
      if (a.odds_to_win === null) return 1;
      if (b.odds_to_win === null) return -1;
      return a.odds_to_win - b.odds_to_win;
    });
}

// ============================================================================
// Single golfer helpers
// ============================================================================

export async function getGolfer(id: string): Promise<Golfer | null> {
  const { data: cachedGolfer, error } = await supabase
    .from('golfers')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching golfer from cache:', error);
  }

  if (cachedGolfer) {
    const needsRefresh = isStale(cachedGolfer.last_updated, GOLFER_REFRESH_INTERVAL);
    if (!needsRefresh) return cachedGolfer;
  }

  if (cachedGolfer) {
    try {
      const apiGolfer = await getGolferFromAPI(cachedGolfer.sportsdata_id) as SportsDataGolfer;
      await trackAPICall(`/Player/${cachedGolfer.sportsdata_id}`, 'golfer');
      const transformed = transformGolfer(apiGolfer);
      const { data: updatedGolfer, error: updateError } = await supabase
        .from('golfers')
        .update({ ...transformed, last_updated: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (updateError) return cachedGolfer;
      return updatedGolfer;
    } catch {
      return cachedGolfer;
    }
  }

  return cachedGolfer || null;
}

export async function getGolferBySportsDataId(sportsdataId: string): Promise<Golfer | null> {
  const { data, error } = await supabase
    .from('golfers')
    .select('*')
    .eq('sportsdata_id', sportsdataId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching golfer:', error);
    return null;
  }

  return data;
}
