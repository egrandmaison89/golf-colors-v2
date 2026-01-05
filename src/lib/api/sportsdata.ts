/**
 * SportsData.io API Client
 * 
 * This module handles all interactions with the SportsData.io API.
 * All API calls should go through this module to enable:
 * - Centralized error handling
 * - Rate limit tracking
 * - Request/response logging
 * - Future: request retry logic
 */

const API_BASE_URL = 'https://api.sportsdata.io/v3/golf';
const API_KEY = import.meta.env.VITE_SPORTSDATA_API_KEY;

if (!API_KEY) {
  console.warn('VITE_SPORTSDATA_API_KEY not set. API calls will fail.');
}

/**
 * Make a request to SportsData.io API
 */
async function apiRequest<T>(endpoint: string): Promise<T> {
  if (!API_KEY) {
    throw new Error('SportsData.io API key not configured');
  }

  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    headers: {
      'Ocp-Apim-Subscription-Key': API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`SportsData.io API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Track API usage in Supabase for rate limit monitoring
 */
async function trackAPICall(endpoint: string, dataType: string) {
  // This will be implemented once Supabase client is available
  // For now, just log
  console.log(`[API Call] ${dataType} - ${endpoint}`);
}

/**
 * Get upcoming tournaments
 */
export async function getUpcomingTournaments() {
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
 * Note: Actual SportsData.io endpoints may differ.
 * Update these based on their actual API documentation.
 * 
 * Common endpoints might be:
 * - /Tournaments (list tournaments)
 * - /Tournament/{id} (tournament details)
 * - /Leaderboard/{tournamentId} (tournament scores)
 * - /Players (list golfers)
 * - /Player/{id} (golfer details)
 */

