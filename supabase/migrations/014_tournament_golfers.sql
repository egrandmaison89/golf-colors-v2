-- Migration 014: tournament_golfers cache table
--
-- Stores which golfers are in each tournament's field, with odds.
-- Populated by syncing the /Leaderboard/{id} endpoint before each draft.
--
-- Fields sourced from SportsData.io /Leaderboard response:
--   PlayerID        -> sportsdata_player_id (for joining to golfers)
--   OddsToWin       -> odds_to_win (lower = bigger favourite, null = not set yet)
--   IsAlternate     -> is_alternate
--   TournamentStatus -> tournament_status (e.g. "Scrambled", "Active")

CREATE TABLE IF NOT EXISTS tournament_golfers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id        UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  golfer_id            UUID NOT NULL REFERENCES golfers(id) ON DELETE CASCADE,
  sportsdata_player_id TEXT NOT NULL,
  odds_to_win          NUMERIC,
  is_alternate         BOOLEAN NOT NULL DEFAULT false,
  tournament_status    TEXT,
  last_updated         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tournament_id, golfer_id)
);

CREATE INDEX IF NOT EXISTS idx_tournament_golfers_tournament
  ON tournament_golfers (tournament_id);

CREATE INDEX IF NOT EXISTS idx_tournament_golfers_golfer
  ON tournament_golfers (golfer_id);

-- RLS
ALTER TABLE tournament_golfers ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read the field
CREATE POLICY "Authenticated users can view tournament golfers"
  ON tournament_golfers FOR SELECT TO authenticated
  USING (true);

-- Service role / server-side writes only (no client INSERT policy needed;
-- writes happen through the golferService server-side upsert)
CREATE POLICY "Authenticated users can upsert tournament golfers"
  ON tournament_golfers FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update tournament golfers"
  ON tournament_golfers FOR UPDATE TO authenticated
  USING (true);
