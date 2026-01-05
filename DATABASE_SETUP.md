# Database Setup Guide

## Phase 3 Complete: Database Schema Implementation

All database migration files and TypeScript types have been created.

## Files Created

### SQL Migrations (`supabase/migrations/`)
1. **001_initial_schema.sql** - Creates all 14 tables with indexes
2. **002_rls_policies.sql** - Sets up Row Level Security policies
3. **003_triggers.sql** - Creates triggers for `updated_at` timestamps

### TypeScript Types
- **src/types/database.ts** - Complete TypeScript types matching database schema

## Next Steps: Run Migrations in Supabase

### Step 1: Open Supabase Dashboard
1. Go to [supabase.com](https://supabase.com)
2. Open your project
3. Navigate to **SQL Editor**

### Step 2: Run Migrations in Order

**Migration 1: Initial Schema**
1. Open `supabase/migrations/001_initial_schema.sql`
2. Copy all SQL content
3. Paste into Supabase SQL Editor
4. Click "Run" (or press Cmd/Ctrl + Enter)
5. Wait for success message

**Migration 2: RLS Policies**
1. Open `supabase/migrations/002_rls_policies.sql`
2. Copy all SQL content
3. Paste into Supabase SQL Editor
4. Click "Run"
5. Wait for success message

**Migration 3: Triggers**
1. Open `supabase/migrations/003_triggers.sql`
2. Copy all SQL content
3. Paste into Supabase SQL Editor
4. Click "Run"
5. Wait for success message

### Step 3: Verify Setup

1. **Check Tables**: Go to **Table Editor** - you should see all 14 tables:
   - golfers
   - tournaments
   - tournament_results
   - user_profiles
   - competitions
   - competition_participants
   - draft_order
   - draft_picks
   - alternates
   - competition_scores
   - competition_payments
   - competition_bounties
   - annual_leaderboard
   - api_usage

2. **Check RLS**: Go to **Authentication → Policies** - RLS should be enabled on all tables

3. **Check Functions**: Go to **Database → Functions** - should see `update_updated_at_column()`

## Troubleshooting

### "relation already exists" Error
- Tables may already exist
- Options:
  1. Drop existing tables manually
  2. Or skip migration and verify structure matches

### "permission denied" Error
- Make sure you're using Supabase SQL Editor (has admin access)
- Or use Supabase CLI with proper authentication

### RLS Policies Not Working
- Verify RLS is enabled: Check in Table Editor → Settings
- Verify policies exist: Check Authentication → Policies

## What's Next?

After database is set up:
1. ✅ Database schema ready
2. ✅ TypeScript types ready
3. → Proceed with feature implementation (Phase 4+)

## Schema Summary

The database now supports:
- ✅ Draft system with snake draft
- ✅ 3 picks + 1 alternate per user
- ✅ Team score calculation
- ✅ Payment and bounty tracking
- ✅ Annual leaderboard
- ✅ User profiles with Venmo links
- ✅ API usage tracking for rate limits

All edge cases (missed cuts, withdrawals) are supported in the schema.

