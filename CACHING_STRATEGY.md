# Caching Strategy for API Rate Limits

## Problem Statement

v1 experienced API rate limit issues (1000 free lookups/day). We need a strategic caching approach to minimize external API calls while maintaining data freshness.

## API Usage Analysis

### What Data Comes from External APIs?
- **Tournament data**: Tournament schedules, fields, leaderboards
- **Golfer data**: Golfer information, rankings, stats
- **Tournament results**: Live scores, leaderboard updates

### What Data is Stored in Supabase?
- **Competitions**: User-created competition groups
- **Picks**: User picks for competitions
- **Golfer headshots**: Static images (cached in public folder or Supabase Storage)
- **User profiles**: User data, preferences

## Caching Strategy

### 1. **Database-First Approach**

**Principle**: Store API data in Supabase, refresh strategically.

**Implementation**:
- Tournament data fetched from API → stored in `tournaments` table
- Golfer data fetched from API → stored in `golfers` table
- Tournament results fetched from API → stored in `tournament_results` table

**Refresh Strategy**:
- **Tournaments**: Refresh daily (tournaments don't change frequently)
- **Golfer data**: Refresh weekly (rankings/stats change less frequently)
- **Tournament results**: Refresh every 5-15 minutes during active tournaments
- **Inactive tournaments**: No refresh needed (historical data)

### 2. **Multi-Layer Caching**

```
Component Request
    ↓
React Hook (in-memory cache)
    ↓ (cache miss)
Service Layer (check Supabase)
    ↓ (stale or missing)
External API (only if needed)
    ↓
Update Supabase
    ↓
Return to component
```

### 3. **Cache Implementation Details**

#### Layer 1: In-Memory Cache (React State)
- **Purpose**: Avoid duplicate requests within same session
- **Scope**: Component lifecycle
- **TTL**: Session-based (cleared on page refresh)
- **Implementation**: Custom hooks manage this automatically via React state

#### Layer 2: Supabase Database Cache
- **Purpose**: Persist API data, avoid API calls for stale-but-acceptable data
- **Scope**: All users, persistent
- **TTL**: Varies by data type (see refresh strategy above)
- **Implementation**: Services check `last_updated` timestamp before fetching

#### Layer 3: External API
- **Purpose**: Source of truth for fresh data
- **Usage**: Only when Supabase data is stale or missing
- **Rate Limit**: 1000/day = ~41 calls/hour = ~1 call every 1.5 minutes max

### 4. **Smart Refresh Logic**

```typescript
// Pseudo-code for tournament data fetching
async function getTournament(id: string) {
  // 1. Check in-memory cache (React state)
  if (cachedTournament && isFresh(cachedTournament)) {
    return cachedTournament;
  }
  
  // 2. Check Supabase
  const dbTournament = await getFromSupabase(id);
  const lastUpdated = dbTournament?.last_updated;
  const now = Date.now();
  
  // 3. Determine if refresh needed
  const needsRefresh = 
    !dbTournament || // Missing
    (now - lastUpdated > TOURNAMENT_REFRESH_INTERVAL) || // Stale
    (isActiveTournament(dbTournament) && now - lastUpdated > ACTIVE_REFRESH_INTERVAL); // Active tournament needs frequent updates
  
  if (needsRefresh) {
    // 4. Fetch from API (only if needed)
    const freshData = await fetchFromAPI(id);
    
    // 5. Update Supabase
    await updateSupabase(id, freshData, now);
    
    return freshData;
  }
  
  return dbTournament;
}
```

### 5. **Refresh Intervals by Data Type**

| Data Type | Refresh Interval | Rationale |
|-----------|------------------|-----------|
| **Upcoming Tournaments** | 24 hours | Tournament schedules change infrequently |
| **Active Tournament (Leaderboard)** | 5 minutes | Scores update frequently during play |
| **Completed Tournament** | Never | Historical data doesn't change |
| **Golfer Rankings** | 7 days | Rankings update weekly |
| **Golfer Stats** | 7 days | Stats update weekly |
| **Tournament Field (Golfers)** | 12 hours | Field can change before tournament starts |

### 6. **Active Tournament Detection**

```typescript
function isActiveTournament(tournament: Tournament): boolean {
  const now = new Date();
  const startDate = new Date(tournament.start_date);
  const endDate = new Date(tournament.end_date);
  
  return now >= startDate && now <= endDate;
}
```

### 7. **Background Refresh Strategy**

**Option A: On-Demand Refresh** (Recommended for v2)
- Refresh when user requests data
- Check staleness, fetch if needed
- Simple, no background jobs needed
- **Tradeoff**: First user after stale period triggers API call

**Option B: Scheduled Refresh** (Future optimization)
- Supabase Edge Functions or cron job
- Refresh data proactively
- More complex, requires infrastructure
- **Tradeoff**: Uses API calls even if no one views data

**v2 Decision**: Start with Option A (on-demand). Add Option B later if needed.

### 8. **Cache Invalidation**

**When to Invalidate**:
- User explicitly requests refresh (manual "Refresh" button)
- After making a pick (ensure latest tournament data)
- On competition view (ensure latest leaderboard)

**How to Invalidate**:
- Clear in-memory cache for specific data
- Mark Supabase record as stale (set `last_updated` to old timestamp)
- Force API fetch on next request

### 9. **API Call Tracking**

**Monitor API Usage**:
- Track API calls in Supabase (simple counter table)
- Log each API call with timestamp and data type
- Display usage in admin view (if needed)
- Alert when approaching limit (e.g., >800 calls/day)

**Implementation**:
```typescript
async function trackAPICall(dataType: string) {
  await supabase
    .from('api_usage')
    .insert({ 
      data_type: dataType, 
      timestamp: new Date(),
      day: getCurrentDay()
    });
  
  // Check if approaching limit
  const todayCalls = await getTodayAPICalls();
  if (todayCalls > 800) {
    console.warn('Approaching API rate limit');
  }
}
```

### 10. **Fallback Strategy**

**If API Limit Reached**:
- Serve stale data from Supabase with clear indicator ("Data may be outdated")
- Disable manual refresh button
- Show message: "Rate limit reached. Data will refresh automatically tomorrow."
- Prioritize critical data (active tournament leaderboards) over non-critical (upcoming tournaments)

## Implementation Priority

1. **Phase 1**: Basic Supabase caching (store API data, check before fetching)
2. **Phase 2**: Add refresh intervals and staleness checks
3. **Phase 3**: Add active tournament detection and frequent refresh
4. **Phase 4**: Add API usage tracking
5. **Phase 5**: Add fallback UI for rate limit scenarios

## Code Organization

Caching logic lives in:
- **Services Layer**: `features/tournaments/services/tournamentService.ts`
- **Cache Utilities**: `lib/utils/cache.ts` (shared cache helpers)
- **API Tracking**: `lib/utils/apiTracking.ts`

## Key Principles

1. **Database is cache**: Supabase stores API data, not just user data
2. **Stale is acceptable**: Better to show slightly old data than hit rate limit
3. **Active tournaments prioritized**: More frequent refresh for live tournaments
4. **Transparent to components**: Components don't know about caching, services handle it
5. **Monitor usage**: Track API calls to avoid surprises

## Questions to Answer During Implementation

1. What external API are we using? (PGA Tour API? Other?)
2. What's the exact rate limit structure? (1000/day? Per endpoint?)
3. Are there different rate limits for different endpoints?
4. Can we batch requests? (Get multiple tournaments in one call?)

