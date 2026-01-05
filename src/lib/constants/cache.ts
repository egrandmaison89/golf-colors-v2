/**
 * Cache refresh intervals (in milliseconds)
 * 
 * These determine how often we refresh data from external APIs.
 * Stale data is acceptable to avoid hitting rate limits.
 */

// Tournament data refresh intervals
export const TOURNAMENT_REFRESH_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
export const ACTIVE_TOURNAMENT_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Golfer data refresh intervals
export const GOLFER_REFRESH_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days
export const GOLFER_RANKINGS_REFRESH_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days

// Tournament field refresh interval (golfers in a tournament)
export const TOURNAMENT_FIELD_REFRESH_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours

/**
 * API rate limit tracking
 */
export const API_RATE_LIMIT_DAILY = 1000; // 1000 calls per day
export const API_RATE_LIMIT_WARNING_THRESHOLD = 800; // Warn at 80% usage
