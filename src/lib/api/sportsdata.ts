/**
 * SportsData.io API Client
 * 
 * This module handles all interactions with the SportsData.io API.
 * All API calls should go through this module to enable:
 * - Centralized error handling
 * - Rate limit tracking
 * - Request/response logging
 * - Future: request retry logic
 * 
 * API Documentation:
 * - Interactive API docs: https://redocly.github.io/redoc/?url=https://api.apis.guru/v2/specs/sportsdata.io/golf-v2/1.0/openapi.json
 * - Base URL: https://api.sportsdata.io/golf/v2/json (Schedule by season: /Tournaments/2026)
 * - Authentication: Ocp-Apim-Subscription-Key header
 * - Rate Limit: 1000 calls per day (tracked in api_usage table)
 */

const API_BASE_URL = 'https://api.sportsdata.io/golf/v2/json';
const API_KEY = import.meta.env.VITE_SPORTSDATA_API_KEY;
const USE_EDGE_FUNCTION = import.meta.env.VITE_USE_EDGE_FUNCTION !== 'false'; // Default to true

if (!API_KEY && !USE_EDGE_FUNCTION) {
  console.warn('VITE_SPORTSDATA_API_KEY not set and Edge Function not enabled. API calls will fail.');
}

/**
 * Make a request to SportsData.io API
 * 
 * Uses Supabase Edge Function proxy if enabled, otherwise makes direct API call.
 * Note: Direct API calls will fail due to CORS - use Edge Function in production.
 */
async function apiRequest<T>(endpoint: string): Promise<T> {
  // Use Edge Function proxy if enabled (recommended)
  if (USE_EDGE_FUNCTION) {
    try {
      const { supabase } = await import('@/lib/supabase/client');
      const { data, error } = await supabase.functions.invoke('sportsdata-proxy', {
        body: {
          endpoint,
          method: 'GET',
        },
      });

      if (error) {
        throw new Error(`Edge Function error: ${error.message}`);
      }

      if (!data) {
        throw new Error('Edge Function returned no data');
      }

      return data as T;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // If Edge Function fails, provide helpful error message
      if (errorMessage.includes('Function not found') || errorMessage.includes('404')) {
        throw new Error(
          `Edge Function 'sportsdata-proxy' not found. ` +
          `Please deploy it using: supabase functions deploy sportsdata-proxy. ` +
          `See EDGE_FUNCTION_SETUP.md for instructions.`
        );
      }
      
      throw new Error(`Edge Function proxy failed: ${errorMessage}`);
    }
  }

  // Fallback to direct API call (will fail due to CORS in browser)
  if (!API_KEY) {
    throw new Error(
      'SportsData.io API key not configured. ' +
      'Either set VITE_SPORTSDATA_API_KEY in .env.local (for direct calls) ' +
      'or deploy the Edge Function proxy (recommended). ' +
      'See EDGE_FUNCTION_SETUP.md for instructions.'
    );
  }

  const url = `${API_BASE_URL}${endpoint}`;
  
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'Ocp-Apim-Subscription-Key': API_KEY,
      },
    });
  } catch (error) {
    // Network error (CORS, connection failed, etc.)
    const errorMessage = error instanceof Error ? error.message : 'Unknown network error';
    
    // Detect CORS errors specifically
    if (errorMessage.includes('CORS') || errorMessage.includes('cross-origin') || 
        errorMessage.includes('Access-Control-Allow-Origin') || 
        (error instanceof TypeError && errorMessage.includes('Failed to fetch'))) {
      throw new Error(
        `CORS error: SportsData.io API does not allow direct browser requests. ` +
        `Please enable the Edge Function proxy by setting VITE_USE_EDGE_FUNCTION=true ` +
        `or deploy the Edge Function. See EDGE_FUNCTION_SETUP.md for instructions.`
      );
    }
    
    throw new Error(`Failed to connect to SportsData.io API: ${errorMessage}. Please check your internet connection and API endpoint.`);
  }

  if (!response.ok) {
    // Try to get error details from response
    let errorDetails = '';
    try {
      const errorBody = await response.text();
      if (errorBody) {
        errorDetails = ` - ${errorBody.substring(0, 200)}`;
      }
    } catch {
      // Ignore if we can't read error body
    }
    
    throw new Error(
      `SportsData.io API error: ${response.status} ${response.statusText}${errorDetails}. ` +
      `Endpoint: ${endpoint}. ` +
      `Please verify your API key is valid and has access to the Golf API.`
    );
  }

  return response.json() as Promise<T>;
}

/**
 * Track API usage in Supabase for rate limit monitoring
 * 
 * Records each API call to the api_usage table for daily rate limit tracking.
 * Warns when approaching the 1000 calls/day limit.
 * 
 * Note: This delegates to the apiTracking utility which properly handles Supabase client.
 */
async function trackAPICall(endpoint: string, dataType: string) {
  try {
    const { trackAPICall: track } = await import('@/lib/utils/apiTracking');
    await track(endpoint, dataType);
  } catch (error) {
    // Don't fail the request if tracking fails - just log
    console.error('Failed to track API call:', error);
  }
}

/**
 * Get tournaments for a season (e.g. 2026)
 * Uses Schedule - by Season endpoint for explicit year.
 */
export async function getTournamentsBySeason(season: number) {
  const endpoint = `/Tournaments/${season}`;
  const data = await apiRequest(endpoint);
  await trackAPICall(endpoint, 'tournament');
  return data;
}

/**
 * Get upcoming/current season tournaments
 * Falls back to current calendar year if no season-specific endpoint exists.
 */
export async function getUpcomingTournaments() {
  const currentYear = new Date().getFullYear();
  try {
    const data = await getTournamentsBySeason(currentYear);
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch {
    // Fall through to try next year
  }
  try {
    const data = await getTournamentsBySeason(currentYear + 1);
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch {
    // Fall through
  }
  const data = await apiRequest('/Tournaments');
  await trackAPICall('/Tournaments', 'tournament');
  return data;
}

/**
 * Get tournament details by ID
 */
export async function getTournament(tournamentId: string) {
  const data = await apiRequest(`/Tournament/${tournamentId}`);
  await trackAPICall(`/Tournament/${tournamentId}`, 'tournament');
  return data;
}

/**
 * Get tournament leaderboard/scores
 */
export async function getTournamentLeaderboard(tournamentId: string) {
  const data = await apiRequest(`/Leaderboard/${tournamentId}`);
  await trackAPICall(`/Leaderboard/${tournamentId}`, 'leaderboard');
  return data;
}

/**
 * Get golfers
 */
export async function getGolfers() {
  const data = await apiRequest('/Players');
  await trackAPICall('/Players', 'golfer');
  return data;
}

/**
 * Get golfer by ID
 */
export async function getGolfer(golferId: string) {
  const data = await apiRequest(`/Player/${golferId}`);
  await trackAPICall(`/Player/${golferId}`, 'golfer');
  return data;
}

/**
 * API Endpoints Reference
 * 
 * Based on SportsData.io Golf API v2.
 * Base URL: https://api.sportsdata.io/golf/v2/json
 * 
 * Implemented endpoints:
 * - GET /Tournaments - Returns array of tournament objects
 * - GET /Tournament/{tournamentId} - Returns single tournament details
 * - GET /Leaderboard/{tournamentId} - Returns tournament leaderboard/scores
 * - GET /Players - Returns array of player/golfer objects
 * - GET /Player/{playerId} - Returns single player/golfer details
 * 
 * Response formats are defined in:
 * - src/features/tournaments/types.ts (SportsDataTournament, SportsDataLeaderboardEntry)
 * - src/features/golfers/types.ts (SportsDataGolfer - if exists)
 * 
 * For full API documentation, see:
 * https://redocly.github.io/redoc/?url=https://api.apis.guru/v2/specs/sportsdata.io/golf-v2/1.0/openapi.json
 */

