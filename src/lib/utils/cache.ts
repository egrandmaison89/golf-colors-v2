/**
 * Cache utility functions
 */

/**
 * Check if data is stale based on last updated timestamp
 */
export function isStale(
  lastUpdated: string | Date,
  refreshIntervalMs: number
): boolean {
  const lastUpdatedDate = typeof lastUpdated === 'string' 
    ? new Date(lastUpdated) 
    : lastUpdated;
  const now = new Date();
  const age = now.getTime() - lastUpdatedDate.getTime();
  return age > refreshIntervalMs;
}

/**
 * Check if a tournament is currently active (between start and end date)
 */
export function isActiveTournament(
  startDate: string | Date,
  endDate: string | Date
): boolean {
  const now = new Date();
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  return now >= start && now <= end;
}

/**
 * Check if a tournament is completed (past end date)
 */
export function isCompletedTournament(endDate: string | Date): boolean {
  const now = new Date();
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  return now > end;
}

