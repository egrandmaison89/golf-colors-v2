# Supabase Edge Function Setup for SportsData.io API Proxy

## Problem

SportsData.io API does not support CORS requests from browser clients. Direct API calls from the frontend will fail with CORS errors.

## Solution

Use a Supabase Edge Function to proxy API requests. This allows:
- Server-side API calls (no CORS issues)
- API key security (key stored server-side, not exposed to browser)
- Rate limit management
- Request logging

## Setup Instructions

### Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) installed (`npm install -g supabase` or `npx supabase`)
- Project reference: `mjxygrbfvlrvhyjrepqq` (golf-colors-db-v2)
- Access token for deployment (from Supabase Dashboard → Account Settings → Access Tokens)

### 1. Deploy the Edge Function

From the project root:

```bash
# Using project reference (no link required)
SUPABASE_ACCESS_TOKEN=your-access-token npx supabase functions deploy sportsdata-proxy --project-ref mjxygrbfvlrvhyjrepqq
```

Or if you have Supabase CLI installed and project linked:

```bash
supabase functions deploy sportsdata-proxy
```

**Note**: First deploy may take 1-2 minutes while Docker images are pulled. Do not interrupt.

### 2. Set API Key and Optional Version

Set the API key (required):

The Edge Function reads `SPORTSDATA_API_KEY` from Supabase secrets. Set it via CLI:

```bash
# Replace with your actual SportsData.io API key
SUPABASE_ACCESS_TOKEN=your-access-token npx supabase secrets set SPORTSDATA_API_KEY=your-sportsdata-api-key --project-ref mjxygrbfvlrvhyjrepqq
```

You can use the same key from `VITE_SPORTSDATA_API_KEY` in your `.env.local`. The proxy uses the Golf v2 API: `https://api.sportsdata.io/golf/v2/json`.

### 3. Frontend Configuration

The frontend ([`src/lib/api/sportsdata.ts`](src/lib/api/sportsdata.ts)) already uses the Edge Function when `VITE_USE_EDGE_FUNCTION` is not explicitly set to `false`. No code changes needed.

The Supabase client automatically passes the user's auth token when invoking the function (users must be logged in to access `/tournaments`).

## Testing

1. Deploy the function (see Step 1 above)
2. Set the API key secret (see Step 2 above)
3. Restart dev server: `npm run dev`
4. Log in and visit `/tournaments` - tournaments should load from SportsData.io API
5. Click a tournament and use "Create competition" to create a competition

## npm Script

For convenience, a deploy script is available (requires `SUPABASE_ACCESS_TOKEN` in environment):

```bash
SUPABASE_ACCESS_TOKEN=your-token npm run supabase:deploy-functions
```

## Security Notes

- API key is stored in Supabase secrets, not exposed to client
- Edge Function requires authentication (Supabase JWT)
- Rate limiting still tracked in `api_usage` table

## Troubleshooting

### Only test tournament shows / no 2026 tournaments

1. **Cache logic**: The app now fetches from the API when it has no current-season data. If you still see only old data, click **Refresh** (which forces a sync from the API).
2. **Edge Function not deployed**: Deploy the function (Step 1) and set `SPORTSDATA_API_KEY` (Step 2). Check the Network tab in DevTools for `sportsdata-proxy` requests; 404 means the function is not deployed.
3. **API key not set**: A 500 error from the proxy often means `SPORTSDATA_API_KEY` is missing in Supabase secrets. Set it via `npx supabase secrets set SPORTSDATA_API_KEY=your-key --project-ref mjxygrbfvlrvhyjrepqq`.
4. **RLS blocking upserts**: Ensure migration `008_tournaments_golfers_cache_policies.sql` is applied so authenticated users can insert/update cached tournaments.

### No tournaments after refresh

- **401 Unauthorized**: You must be logged in. The Edge Function requires the Supabase auth token.
- **CORS errors**: These indicate the request never reached the Edge Function; verify the function is deployed and the frontend is using it (check `VITE_USE_EDGE_FUNCTION` is not set to `false`).
- **Empty list**: If the API returns data but the list is empty, check the browser console for upsert errors. RLS policies must allow INSERT/UPDATE on `tournaments`.

### Debug logging

Set `VITE_DEBUG_TOURNAMENTS=true` in `.env.local` to enable detailed console logs for the tournament fetch flow (API attempt, response count, upsert success/failure).

## Alternative Solutions

If not using Supabase Edge Functions:
- Create a simple Express.js proxy server
- Use Vercel/Netlify serverless functions
- Use a dedicated API gateway service

