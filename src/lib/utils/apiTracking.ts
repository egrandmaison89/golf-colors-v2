/**
 * API usage tracking utilities
 * 
 * Tracks API calls to monitor rate limit usage
 */

import { supabase } from '@/lib/supabase/client';

/**
 * Track an API call in the database
 */
export async function trackAPICall(
  endpoint: string,
  dataType: string
): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    await supabase.from('api_usage').insert({
      endpoint,
      data_type: dataType,
      day: today,
    });

    // Check if we're approaching the limit
    const { data: todayCalls } = await supabase
      .from('api_usage')
      .select('id', { count: 'exact', head: true })
      .eq('day', today);

    const callCount = todayCalls?.length || 0;
    if (callCount > 800) {
      console.warn(
        `⚠️ Approaching API rate limit: ${callCount}/1000 calls used today`
      );
    }
  } catch (error) {
    // Don't fail the request if tracking fails
    console.error('Failed to track API call:', error);
  }
}

/**
 * Get today's API call count
 */
export async function getTodayAPICallCount(): Promise<number> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase
      .from('api_usage')
      .select('*', { count: 'exact', head: true })
      .eq('day', today);

    return count || 0;
  } catch (error) {
    console.error('Failed to get API call count:', error);
    return 0;
  }
}

