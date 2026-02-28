-- Migration 021: Add anon RLS policies for public-facing data
--
-- The homepage shows tournament leaderboards to unauthenticated visitors.
-- Previously, ALL table policies were restricted to `authenticated` only,
-- which meant the anon role couldn't read tournaments, golfers, or results.
-- This also blocked the tournament cache from being populated on first visit.
--
-- These tables contain public API cache data (no user-sensitive information),
-- so anon access is safe.

-- ============================================================================
-- TOURNAMENTS: Public read + cache population
-- ============================================================================

CREATE POLICY "Anyone can view tournaments"
  ON tournaments FOR SELECT TO anon USING (true);

CREATE POLICY "Anyone can insert tournaments"
  ON tournaments FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anyone can update tournaments"
  ON tournaments FOR UPDATE TO anon USING (true);

-- ============================================================================
-- GOLFERS: Public read + cache population
-- ============================================================================

CREATE POLICY "Anyone can view golfers"
  ON golfers FOR SELECT TO anon USING (true);

CREATE POLICY "Anyone can insert golfers"
  ON golfers FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anyone can update golfers"
  ON golfers FOR UPDATE TO anon USING (true);

-- ============================================================================
-- TOURNAMENT RESULTS: Public read (for homepage leaderboard display)
-- ============================================================================

CREATE POLICY "Anyone can view tournament results"
  ON tournament_results FOR SELECT TO anon USING (true);

-- ============================================================================
-- API USAGE: Allow tracking from any visitor
-- ============================================================================

CREATE POLICY "Anyone can insert API usage"
  ON api_usage FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anyone can view API usage"
  ON api_usage FOR SELECT TO anon USING (true);
