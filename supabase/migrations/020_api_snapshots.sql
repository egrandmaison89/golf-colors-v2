-- Migration 020: API Snapshots table
--
-- Captures raw SportsData.io /Leaderboard/ responses at each meaningful
-- tournament state transition (pre-tournament, each round, post-completion).
--
-- Purpose: debug API field changes over the course of a tournament without
-- having to reproduce live conditions. Query raw_response JSONB in the
-- Supabase SQL editor to inspect exactly what the API returned at each stage.
--
-- Captured by: supabase/functions/sportsdata-proxy/index.ts
-- Deduplication: one snapshot per (tournament × round × status transition)

CREATE TABLE IF NOT EXISTS api_snapshots (
  id                         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint                   TEXT        NOT NULL,   -- e.g. '/Leaderboard/17877'
  sportsdata_tournament_id   TEXT        NOT NULL,   -- Tournament.TournamentID from response
  round_number               INTEGER,                -- Tournament.Round (null = pre-tournament)
  tournament_status          TEXT,                   -- e.g. 'InProgress', 'Completed'
  player_count               INTEGER,
  raw_response               JSONB       NOT NULL,   -- full { Tournament, Players } response
  captured_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deduplicate: one snapshot per (tournament × round × status) combination.
-- COALESCE maps null values to sentinel values so they participate in uniqueness.
-- This gives us one snapshot each time the round number or status changes:
--   null round → -1  (pre-tournament)
--   null status → '__unknown__'
CREATE UNIQUE INDEX idx_api_snapshots_dedup
  ON api_snapshots (
    sportsdata_tournament_id,
    COALESCE(round_number, -1),
    COALESCE(tournament_status, '__unknown__')
  );

CREATE INDEX idx_api_snapshots_tournament  ON api_snapshots (sportsdata_tournament_id);
CREATE INDEX idx_api_snapshots_captured_at ON api_snapshots (captured_at);

-- RLS: only admin users can read snapshots.
-- The edge function writes with the service role key (bypasses RLS).
ALTER TABLE api_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read API snapshots"
  ON api_snapshots
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM user_profiles WHERE is_admin = true
    )
  );

-- ─── Useful debugging queries ───────────────────────────────────────────────
--
-- List all snapshots for a tournament:
--   SELECT id, round_number, tournament_status, player_count, captured_at
--   FROM api_snapshots
--   WHERE sportsdata_tournament_id = '<sportsdata_id>'
--   ORDER BY captured_at;
--
-- Inspect the raw response for a snapshot:
--   SELECT raw_response FROM api_snapshots WHERE id = '<id>';
--
-- Compare Rounds structure across tournament stages:
--   SELECT round_number, tournament_status,
--          raw_response->'Players'->0->'Rounds' AS first_player_rounds
--   FROM api_snapshots
--   WHERE sportsdata_tournament_id = '<sportsdata_id>'
--   ORDER BY round_number NULLS FIRST;
--
-- Check whether a specific round-level field (e.g. ToPar) exists in each snapshot:
--   SELECT round_number,
--          raw_response->'Players'->0->'Rounds'->0 ? 'ToPar' AS has_round_topar,
--          jsonb_array_length(raw_response->'Players'->0->'Rounds'->0->'Holes') AS holes_count
--   FROM api_snapshots
--   WHERE sportsdata_tournament_id = '<sportsdata_id>';
-- ─────────────────────────────────────────────────────────────────────────────
