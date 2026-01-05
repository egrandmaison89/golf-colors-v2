/**
 * Golfer Service
 * 
 * Handles golfer data fetching with multi-layer caching:
 * 1. Check Supabase cache
 * 2. Determine if refresh needed (based on staleness)
 * 3. Fetch from SportsData.io API if needed
 * 4. Update Supabase cache
 * 5. Return data
 */

import { supabase } from '@/lib/supabase/client';
import { getGolfers, getGolfer as getGolferFromAPI } from '@/lib/api/sportsdata';
import { trackAPICall } from '@/lib/utils/apiTracking';
import { GOLFER_REFRESH_INTERVAL } from '@/lib/constants/cache';
import { isStale } from '@/lib/utils/cache';
import type { Golfer, SportsDataGolfer } from '../types';

/**
 * Transform SportsData.io golfer to our database format
 */
function transformGolfer(apiGolfer: SportsDataGolfer): Omit<Golfer, 'id' | 'created_at' | 'last_updated'> {
  return {
    sportsdata_id: apiGolfer.PlayerID.toString(),
    first_name: apiGolfer.FirstName,
    last_name: apiGolfer.LastName,
    display_name: `${apiGolfer.FirstName} ${apiGolfer.LastName}`,
    headshot_url: null, // Will be set separately or from another source
    country: apiGolfer.Country || null,
    world_ranking: apiGolfer.WorldRanking || null,
  };
}

/**
 * Get all golfers (with caching)
 */
export async function getGolfersList(): Promise<Golfer[]> {
  // 1. Check Supabase cache first
  const { data: cachedGolfers, error: fetchError } = await supabase
    .from('golfers')
    .select('*')
    .order('world_ranking', { ascending: true, nullsFirst: false });

  if (fetchError) {
    console.error('Error fetching golfers from cache:', fetchError);
  }

  // 2. Check if refresh needed
  const needsRefresh = !cachedGolfers || cachedGolfers.length === 0 ||
    cachedGolfers.some(golfer => isStale(golfer.last_updated, GOLFER_REFRESH_INTERVAL));

  if (!needsRefresh && cachedGolfers) {
    return cachedGolfers;
  }

  // 3. Fetch from API if needed
  try {
    const apiGolfers = await getGolfers() as SportsDataGolfer[];
    await trackAPICall('/Players', 'golfer');

    // Transform and upsert to database
    const golfersToUpsert = apiGolfers.map((apiGolfer) => {
      const transformed = transformGolfer(apiGolfer);
      return {
        ...transformed,
        last_updated: new Date().toISOString(),
      };
    });

    // Upsert golfers (update if exists, insert if not)
    const { data: updatedGolfers, error: upsertError } = await supabase
      .from('golfers')
      .upsert(golfersToUpsert, {
        onConflict: 'sportsdata_id',
        ignoreDuplicates: false,
      })
      .select()
      .order('world_ranking', { ascending: true, nullsFirst: false });

    if (upsertError) {
      console.error('Error upserting golfers:', upsertError);
      // Return cached data if upsert fails
      return cachedGolfers || [];
    }

    return updatedGolfers || [];
  } catch (error) {
    console.error('Error fetching golfers from API:', error);
    // Return cached data if API fails
    return cachedGolfers || [];
  }
}

/**
 * Get a single golfer by ID (with caching)
 */
export async function getGolfer(id: string): Promise<Golfer | null> {
  // Try to get from cache first
  const { data: cachedGolfer, error } = await supabase
    .from('golfers')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 is "not found", which is fine
    console.error('Error fetching golfer from cache:', error);
  }

  // Check if refresh needed
  if (cachedGolfer) {
    const needsRefresh = isStale(cachedGolfer.last_updated, GOLFER_REFRESH_INTERVAL);

    if (!needsRefresh) {
      return cachedGolfer;
    }
  }

  // Fetch from API if needed
  if (cachedGolfer) {
    try {
      const apiGolfer = await getGolferFromAPI(cachedGolfer.sportsdata_id) as SportsDataGolfer;
      await trackAPICall(`/Player/${cachedGolfer.sportsdata_id}`, 'golfer');

      const transformed = transformGolfer(apiGolfer);
      const { data: updatedGolfer, error: updateError } = await supabase
        .from('golfers')
        .update({
          ...transformed,
          last_updated: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating golfer:', updateError);
        return cachedGolfer;
      }

      return updatedGolfer;
    } catch (error) {
      console.error('Error fetching golfer from API:', error);
      return cachedGolfer;
    }
  }

  // Golfer not in cache - would need sportsdata_id to fetch
  return cachedGolfer || null;
}

/**
 * Get golfer by sportsdata_id (for API lookups)
 */
export async function getGolferBySportsDataId(
  sportsdataId: string
): Promise<Golfer | null> {
  const { data, error } = await supabase
    .from('golfers')
    .select('*')
    .eq('sportsdata_id', sportsdataId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    console.error('Error fetching golfer:', error);
    return null;
  }

  return data;
}

