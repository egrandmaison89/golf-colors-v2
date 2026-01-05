-- Migration: Row Level Security (RLS) Policies
-- Description: Sets up RLS policies for all tables
-- Run this after 001_initial_schema.sql

-- Enable RLS on all tables
ALTER TABLE golfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE alternates ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_bounties ENABLE ROW LEVEL SECURITY;
ALTER TABLE annual_leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- GOLF DATA (Public read, authenticated users)
-- ============================================================================

-- Golfers: All authenticated users can read
CREATE POLICY "Golfers are viewable by authenticated users"
  ON golfers FOR SELECT
  TO authenticated
  USING (true);

-- Tournaments: All authenticated users can read
CREATE POLICY "Tournaments are viewable by authenticated users"
  ON tournaments FOR SELECT
  TO authenticated
  USING (true);

-- Tournament results: All authenticated users can read
CREATE POLICY "Tournament results are viewable by authenticated users"
  ON tournament_results FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- USER PROFILES
-- ============================================================================

-- User profiles: All users can read (for Venmo links), users can update their own
CREATE POLICY "User profiles are viewable by authenticated users"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- COMPETITIONS
-- ============================================================================

-- Competitions: Users can read competitions they're participants in
CREATE POLICY "Users can view competitions they participate in"
  ON competitions FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT competition_id FROM competition_participants
      WHERE user_id = auth.uid()
    )
    OR created_by = auth.uid()
  );

-- Users can create competitions
CREATE POLICY "Users can create competitions"
  ON competitions FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Competition creators can update/delete their competitions
CREATE POLICY "Competition creators can update their competitions"
  ON competitions FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Competition creators can delete their competitions"
  ON competitions FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- ============================================================================
-- COMPETITION PARTICIPANTS
-- ============================================================================

-- Competition participants: Users can read participants for competitions they're in
CREATE POLICY "Users can view participants in their competitions"
  ON competition_participants FOR SELECT
  TO authenticated
  USING (
    competition_id IN (
      SELECT competition_id FROM competition_participants
      WHERE user_id = auth.uid()
    )
  );

-- Users can join competitions
CREATE POLICY "Users can join competitions"
  ON competition_participants FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- DRAFT ORDER
-- ============================================================================

-- Draft order: Users can read draft order for competitions they're in
CREATE POLICY "Users can view draft order in their competitions"
  ON draft_order FOR SELECT
  TO authenticated
  USING (
    competition_id IN (
      SELECT competition_id FROM competition_participants
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- DRAFT PICKS
-- ============================================================================

-- Draft picks: Users can read picks for competitions they're in
CREATE POLICY "Users can view draft picks in their competitions"
  ON draft_picks FOR SELECT
  TO authenticated
  USING (
    competition_id IN (
      SELECT competition_id FROM competition_participants
      WHERE user_id = auth.uid()
    )
  );

-- Users can create their own picks (when it's their turn - validated in application)
CREATE POLICY "Users can create their own draft picks"
  ON draft_picks FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users cannot update/delete picks after tournament starts (validated in application)

-- ============================================================================
-- ALTERNATES
-- ============================================================================

-- Alternates: Users can read alternates for competitions they're in
CREATE POLICY "Users can view alternates in their competitions"
  ON alternates FOR SELECT
  TO authenticated
  USING (
    competition_id IN (
      SELECT competition_id FROM competition_participants
      WHERE user_id = auth.uid()
    )
  );

-- Users can create/update their own alternate
CREATE POLICY "Users can create their own alternate"
  ON alternates FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own alternate"
  ON alternates FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- COMPETITION SCORES
-- ============================================================================

-- Competition scores: Users can read scores for competitions they're in
CREATE POLICY "Users can view scores in their competitions"
  ON competition_scores FOR SELECT
  TO authenticated
  USING (
    competition_id IN (
      SELECT competition_id FROM competition_participants
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- COMPETITION PAYMENTS
-- ============================================================================

-- Competition payments: Users can read payments for competitions they're in
CREATE POLICY "Users can view payments in their competitions"
  ON competition_payments FOR SELECT
  TO authenticated
  USING (
    competition_id IN (
      SELECT competition_id FROM competition_participants
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- COMPETITION BOUNTIES
-- ============================================================================

-- Competition bounties: Users can read bounties for competitions they're in
CREATE POLICY "Users can view bounties in their competitions"
  ON competition_bounties FOR SELECT
  TO authenticated
  USING (
    competition_id IN (
      SELECT competition_id FROM competition_participants
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- ANNUAL LEADERBOARD
-- ============================================================================

-- Annual leaderboard: All authenticated users can read (public leaderboard)
CREATE POLICY "Annual leaderboard is viewable by authenticated users"
  ON annual_leaderboard FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- API USAGE
-- ============================================================================

-- API usage: Only service role can insert (for tracking), authenticated users can read
CREATE POLICY "Authenticated users can view API usage"
  ON api_usage FOR SELECT
  TO authenticated
  USING (true);

