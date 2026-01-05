# Environment Variables Setup

Create a `.env.local` file in the project root with the following variables:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# SportsData.io API
VITE_SPORTSDATA_API_KEY=your-sportsdata-api-key
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
4. Copy API key → `VITE_SPORTSDATA_API_KEY`

## Important Notes

- **Never commit `.env.local`** - it's in `.gitignore`
- Use `.env.example` as a template
- Restart dev server after changing environment variables
- Vite requires `VITE_` prefix for client-side variables

