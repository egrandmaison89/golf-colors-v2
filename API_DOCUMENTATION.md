# SportsData.io API Documentation

## Overview

This application uses the SportsData.io Golf API v3 to fetch tournament and golfer data. All API interactions are handled through the centralized client in `src/lib/api/sportsdata.ts`.

## API Reference

**Interactive API Documentation:**
https://redocly.github.io/redoc/?url=https://api.apis.guru/v2/specs/sportsdata.io/golf-v2/1.0/openapi.json

**Base URL:** `https://api.sportsdata.io/v3/golf`

**Authentication:** 
- Header: `Ocp-Apim-Subscription-Key`
- Value: Set via `VITE_SPORTSDATA_API_KEY` environment variable

**Rate Limit:** 1000 calls per day (tracked in `api_usage` table)

## Implemented Endpoints

### Tournaments

#### `GET /Tournaments` (current season)
Returns tournaments for the current season. May return empty if no tournaments scheduled.

#### `GET /Tournaments/{season}` (by season - e.g. 2026)
**Use this for 2026 PGA events.** The Schedule - by Season endpoint returns tournaments for a specific year.

**Response Type:** `SportsDataTournament[]`

**Fields Used:**
- `TournamentID` (number) → `sportsdata_id` (string)
- `Name` (string) → `name`
- `StartDate` (string) → `start_date`
- `EndDate` (string) → `end_date`
- `Course` (string?) → `course_name`
- `Purse` (number?) → `purse`

**Status Calculation:**
- `upcoming`: Current date < start date
- `active`: Current date between start and end date
- `completed`: Current date > end date

#### `GET /Tournament/{tournamentId}`
Returns a single tournament's details.

**Response Type:** `SportsDataTournament`

**Usage:** Used to refresh individual tournament data when cache is stale.

### Leaderboard

#### `GET /Leaderboard/{tournamentId}`
Returns tournament leaderboard/scores.

**Response Type:** `SportsDataLeaderboardEntry[]`

**Fields:**
- `PlayerID` (number)
- `Position` (number?)
- `TotalStrokes` (number?)
- `TotalScore` (number?) - Score relative to par
- `Rounds` (array?)
- `Earnings` (number?)
- `MadeCut` (boolean?)
- `Withdrew` (boolean?)

**Status:** Implemented but not yet fully integrated into scoring logic.

### Players/Golfers

#### `GET /Players`
Returns an array of player/golfer objects.

**Response Type:** `SportsDataGolfer[]` (to be defined)

**Status:** Endpoint exists but golfer types not yet fully defined.

#### `GET /Player/{playerId}`
Returns a single player's details.

**Response Type:** `SportsDataGolfer` (to be defined)

**Status:** Endpoint exists but golfer types not yet fully defined.

## Caching Strategy

See [CACHING_STRATEGY.md](./CACHING_STRATEGY.md) for details on how API data is cached to manage rate limits.

**Key Points:**
- Tournament data cached in `tournaments` table
- Refresh intervals based on tournament status (active vs upcoming vs completed)
- API calls only made when cache is stale or missing
- All API calls tracked in `api_usage` table

## Error Handling

API errors are handled in `src/lib/api/sportsdata.ts`:

- Missing API key: Throws error immediately
- HTTP errors: Throws error with status code and message
- Network errors: Propagated to calling code
- Invalid responses: Validated in service layer (e.g., `tournamentService.ts`)

## Rate Limit Management

- All API calls are tracked in the `api_usage` table
- Daily call count checked after each API call
- Warning logged when approaching 800 calls (80% of limit)
- See `src/lib/utils/apiTracking.ts` for tracking implementation

## Type Definitions

API response types are defined in:
- `src/features/tournaments/types.ts` - Tournament and leaderboard types
- `src/features/golfers/types.ts` - Golfer types (when implemented)

## API Base URL

We use the Golf v2 API: `https://api.sportsdata.io/golf/v2/json` (e.g. `/Tournaments/2026` for 2026 season tournaments).

## CORS Issue and Solution

**Important:** SportsData.io API does not support CORS requests from browser clients. Direct API calls from the frontend will fail with CORS errors.

### Current Status
- ❌ Direct browser calls to SportsData.io API will fail due to CORS
- ✅ API calls should be proxied through a backend server

### Solution: Supabase Edge Function Proxy

Create a Supabase Edge Function to proxy API requests. This allows:
- Server-side API calls (no CORS issues)
- API key security (key stored server-side, not exposed to browser)
- Rate limit management
- Request logging

**Implementation Steps:**
1. Create a Supabase Edge Function (see `supabase/functions/sportsdata-proxy/`)
2. Move API key to Supabase secrets (not in `.env.local`)
3. Update `src/lib/api/sportsdata.ts` to call the Edge Function instead of direct API
4. Edge Function makes the actual API call and returns data

**Alternative:** Use a simple Node.js/Express proxy server if not using Supabase Edge Functions.

## Future Enhancements

- [x] Detect and handle CORS errors gracefully
- [ ] Create Supabase Edge Function proxy for API calls
- [ ] Move API key to Supabase secrets
- [ ] Implement retry logic for transient failures
- [ ] Add request/response logging for debugging
- [ ] Implement exponential backoff for rate limit errors
- [ ] Add webhook support for real-time tournament updates (if API supports)
- [ ] Complete golfer type definitions and integration

## Notes

- Endpoints may vary slightly from documentation - always test with actual API
- **API key should NOT be in `.env.local` for production** - use Supabase secrets instead
- Rate limit is per day, resets at midnight UTC
- Consider implementing request queuing if approaching rate limits frequently
- CORS errors indicate the need for a backend proxy - see solution above

