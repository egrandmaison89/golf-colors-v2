/**
 * Tournament Service
 * 
 * Handles tournament data fetching with multi-layer caching:
 * 1. Check Supabase cache
 * 2. Determine if refresh needed (based on staleness and tournament status)
 * 3. Fetch from SportsData.io API if needed
 * 4. Update Supabase cache
 * 5. Return data
 */

import { supabase } from '@/lib/supabase/client';
import {
  getUpcomingTournaments,
  getTournament as getTournamentFromAPI,
} from '@/lib/api/sportsdata';
import { trackAPICall } from '@/lib/utils/apiTracking';
import {
  TOURNAMENT_REFRESH_INTERVAL,
  ACTIVE_TOURNAMENT_REFRESH_INTERVAL,
} from '@/lib/constants/cache';
import { isStale, isActiveTournament, isCompletedTournament } from '@/lib/utils/cache';
import type { Tournament, SportsDataTournament } from '../types';

/**
 * Transform SportsData.io tournament to our database format
 */
function transformTournament(apiTournament: SportsDataTournament): Omit<Tournament, 'id' | 'created_at' | 'last_updated'> {
  // Determine status based on dates
  const now = new Date();
  const startDate = new Date(apiTournament.StartDate);
  const endDate = new Date(apiTournament.EndDate);
  
  let status: Tournament['status'] = 'upcoming';
  if (now >= startDate && now <= endDate) {
    status = 'active';
  } else if (now > endDate) {
    status = 'completed';
  }

  return {
    sportsdata_id: apiTournament.TournamentID.toString(),
    name: apiTournament.Name,
    start_date: apiTournament.StartDate.split('T')[0], // Extract date part
    end_date: apiTournament.EndDate.split('T')[0],
    status,
    course_name: apiTournament.Course || null,
    purse: apiTournament.Purse ? parseFloat(apiTournament.Purse.toString()) : null,
  };
}

/**
 * Get all tournaments (with caching)
 */
export async function getTournaments(): Promise<Tournament[]> {
  // 1. Check Supabase cache first
  const { data: cachedTournaments, error: fetchError } = await supabase
    .from('tournaments')
    .select('*')
    .order('start_date', { ascending: true });

  if (fetchError) {
    console.error('Error fetching tournaments from cache:', fetchError);
  }

  // 2. Determine which tournaments need refresh
  const needsRefresh: string[] = [];
  const freshTournaments: Tournament[] = [];

  if (cachedTournaments) {
    for (const tournament of cachedTournaments) {
      // Completed tournaments never need refresh
      if (isCompletedTournament(tournament.end_date)) {
        freshTournaments.push(tournament);
        continue;
      }

      // Active tournaments need frequent refresh
      if (isActiveTournament(tournament.start_date, tournament.end_date)) {
        if (isStale(tournament.last_updated, ACTIVE_TOURNAMENT_REFRESH_INTERVAL)) {
          needsRefresh.push(tournament.sportsdata_id);
        } else {
          freshTournaments.push(tournament);
        }
        continue;
      }

      // Upcoming tournaments refresh daily
      if (isStale(tournament.last_updated, TOURNAMENT_REFRESH_INTERVAL)) {
        needsRefresh.push(tournament.sportsdata_id);
      } else {
        freshTournaments.push(tournament);
      }
    }
  }

  // 3. Fetch fresh data for tournaments that need refresh
  if (needsRefresh.length > 0 || !cachedTournaments || cachedTournaments.length === 0) {
    try {
      const apiTournaments = await getUpcomingTournaments() as SportsDataTournament[];
      await trackAPICall('/Tournaments', 'tournament');

      // Transform and upsert to database
      const tournamentsToUpsert = apiTournaments.map((apiTournament) => {
        const transformed = transformTournament(apiTournament);
        return {
          ...transformed,
          last_updated: new Date().toISOString(),
        };
      });

      // Upsert tournaments (update if exists, insert if not)
      const { data: updatedTournaments, error: upsertError } = await supabase
        .from('tournaments')
        .upsert(tournamentsToUpsert, {
          onConflict: 'sportsdata_id',
          ignoreDuplicates: false,
        })
        .select();

      if (upsertError) {
        console.error('Error upserting tournaments:', upsertError);
        // Return cached data if upsert fails
        return freshTournaments;
      }

      // Combine fresh and updated tournaments
      const updatedIds = new Set(updatedTournaments?.map(t => t.sportsdata_id) || []);
      const stillFresh = freshTournaments.filter(t => !updatedIds.has(t.sportsdata_id));
      
      return [...stillFresh, ...(updatedTournaments || [])].sort(
        (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      );
    } catch (error) {
      console.error('Error fetching tournaments from API:', error);
      // Return cached data if API fails
      return freshTournaments;
    }
  }

  return freshTournaments;
}

/**
 * Get a single tournament by ID (with caching)
 */
export async function getTournament(id: string): Promise<Tournament | null> {
  // Try to get from cache first
  const { data: cachedTournament, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 is "not found", which is fine
    console.error('Error fetching tournament from cache:', error);
  }

  // Check if refresh needed
  if (cachedTournament) {
    const needsRefresh = 
      // Completed tournaments never refresh
      !isCompletedTournament(cachedTournament.end_date) &&
      (
        // Active tournaments refresh frequently
        (isActiveTournament(cachedTournament.start_date, cachedTournament.end_date) &&
         isStale(cachedTournament.last_updated, ACTIVE_TOURNAMENT_REFRESH_INTERVAL)) ||
        // Upcoming tournaments refresh daily
        (!isActiveTournament(cachedTournament.start_date, cachedTournament.end_date) &&
         isStale(cachedTournament.last_updated, TOURNAMENT_REFRESH_INTERVAL))
      );

    if (!needsRefresh) {
      return cachedTournament;
    }
  }

  // Fetch from API if needed
  if (cachedTournament) {
    try {
      const apiTournament = await getTournamentFromAPI(cachedTournament.sportsdata_id) as SportsDataTournament;
      await trackAPICall(`/Tournament/${cachedTournament.sportsdata_id}`, 'tournament');

      const transformed = transformTournament(apiTournament);
      const { data: updatedTournament, error: updateError } = await supabase
        .from('tournaments')
        .update({
          ...transformed,
          last_updated: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating tournament:', updateError);
        return cachedTournament;
      }

      return updatedTournament;
    } catch (error) {
      console.error('Error fetching tournament from API:', error);
      return cachedTournament;
    }
  }

  // Tournament not in cache - would need sportsdata_id to fetch
  // For now, return null (this case shouldn't happen in normal flow)
  return cachedTournament || null;
}

/**
 * Get tournament by sportsdata_id (for API lookups)
 */
export async function getTournamentBySportsDataId(
  sportsdataId: string
): Promise<Tournament | null> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('sportsdata_id', sportsdataId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    console.error('Error fetching tournament:', error);
    return null;
  }

  return data;
}

