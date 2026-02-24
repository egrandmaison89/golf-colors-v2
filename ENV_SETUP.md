# Environment Variables Setup

Create a `.env.local` file in the project root with the following variables:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# SportsData.io API (optional - used when Edge Function proxy is deployed)
# When using Edge Function, the key is stored in Supabase secrets instead
VITE_SPORTSDATA_API_KEY=your-sportsdata-api-key

# Set to false to use direct API calls (will fail with CORS in browser)
# VITE_USE_EDGE_FUNCTION=true
```

## Getting Your Credentials

### Supabase
1. Go to [supabase.com](https://supabase.com)
2. Create a project (or use existing)
3. Go to Project Settings → API
4. Copy:
   - Project URL → `VITE_SUPABASE_URL`
   - `anon` `public` key → `VITE_SUPABASE_ANON_KEY`

### SportsData.io
1. Go to [sportsdata.io](https://sportsdata.io)
2. Sign up for an account
3. Get your API key from the dashboard
4. For Edge Function (recommended): Set via `supabase secrets set SPORTSDATA_API_KEY=your-key`
5. For direct calls: Add to `.env.local` as `VITE_SPORTSDATA_API_KEY` (note: direct calls fail with CORS in browser)

See [EDGE_FUNCTION_SETUP.md](./EDGE_FUNCTION_SETUP.md) for full setup.

## Important Notes

- **Never commit `.env.local`** - it's in `.gitignore`
- Use `.env.example` as a template
- Restart dev server after changing environment variables
- Vite requires `VITE_` prefix for client-side variables

