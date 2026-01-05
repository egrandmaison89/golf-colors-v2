-- Migration: Initial Database Schema
-- Description: Creates all tables for Golf Colors v2
-- Run this in Supabase SQL Editor or via Supabase CLI

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- GOLF DATA TABLES (from sportsdata.io API, cached in Supabase)
-- ============================================================================

-- Golfers table
CREATE TABLE golfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sportsdata_id TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  headshot_url TEXT,
  country TEXT,
  world_ranking INTEGER,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_golfers_sportsdata_id ON golfers(sportsdata_id);
CREATE INDEX idx_golfers_world_ranking ON golfers(world_ranking);

-- Tournaments table
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sportsdata_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('upcoming', 'active', 'completed')),
  course_name TEXT,
  purse DECIMAL(12, 2),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tournaments_sportsdata_id ON tournaments(sportsdata_id);
CREATE INDEX idx_tournaments_dates ON tournaments(start_date, end_date);
CREATE INDEX idx_tournaments_status ON tournaments(status);

-- Tournament results table
CREATE TABLE tournament_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  golfer_id UUID NOT NULL REFERENCES golfers(id) ON DELETE CASCADE,
  position INTEGER,
  total_score INTEGER,
  total_to_par INTEGER,
  rounds JSONB,
  earnings DECIMAL(12, 2),
  made_cut BOOLEAN,
  withdrew BOOLEAN,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tournament_id, golfer_id)
);

CREATE INDEX idx_tournament_results_tournament ON tournament_results(tournament_id);
CREATE INDEX idx_tournament_results_golfer ON tournament_results(golfer_id);
CREATE INDEX idx_tournament_results_position ON tournament_results(tournament_id, position);

-- ============================================================================
-- USER PROFILE
-- ============================================================================

-- User profiles (extends Supabase auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  venmo_link TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_venmo ON user_profiles(venmo_link) WHERE venmo_link IS NOT NULL;

-- ============================================================================
-- COMPETITION TABLES
-- ============================================================================

-- Competitions table
CREATE TABLE competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  draft_status TEXT NOT NULL DEFAULT 'not_started' CHECK (draft_status IN ('not_started', 'in_progress', 'completed', 'canceled')),
  draft_started_at TIMESTAMPTZ,
  draft_completed_at TIMESTAMPTZ,
  pick_deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_competitions_tournament ON competitions(tournament_id);
CREATE INDEX idx_competitions_created_by ON competitions(created_by);
CREATE INDEX idx_competitions_draft_status ON competitions(draft_status);

-- Competition participants
CREATE TABLE competition_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(competition_id, user_id)
);

CREATE INDEX idx_participants_competition ON competition_participants(competition_id);
CREATE INDEX idx_participants_user ON competition_participants(user_id);

-- Draft order
CREATE TABLE draft_order (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(competition_id, user_id),
  UNIQUE(competition_id, position)
);

CREATE INDEX idx_draft_order_competition ON draft_order(competition_id);
CREATE INDEX idx_draft_order_competition_position ON draft_order(competition_id, position);

-- Draft picks
CREATE TABLE draft_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  golfer_id UUID NOT NULL REFERENCES golfers(id) ON DELETE CASCADE,
  draft_round INTEGER NOT NULL CHECK (draft_round IN (1, 2, 3)),
  pick_number INTEGER NOT NULL,
  picked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(competition_id, golfer_id),
  UNIQUE(competition_id, user_id, draft_round)
);

CREATE INDEX idx_draft_picks_competition ON draft_picks(competition_id);
CREATE INDEX idx_draft_picks_user ON draft_picks(user_id);
CREATE INDEX idx_draft_picks_competition_user ON draft_picks(competition_id, user_id);
CREATE INDEX idx_draft_picks_pick_number ON draft_picks(competition_id, pick_number);

-- Alternates
CREATE TABLE alternates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  golfer_id UUID NOT NULL REFERENCES golfers(id) ON DELETE CASCADE,
  selected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(competition_id, user_id)
);

CREATE INDEX idx_alternates_competition ON alternates(competition_id);
CREATE INDEX idx_alternates_user ON alternates(user_id);

-- Competition scores
CREATE TABLE competition_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_score_strokes INTEGER NOT NULL,
  team_score_to_par INTEGER NOT NULL,
  final_position INTEGER,
  score_breakdown JSONB,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(competition_id, user_id)
);

CREATE INDEX idx_scores_competition ON competition_scores(competition_id);
CREATE INDEX idx_scores_user ON competition_scores(user_id);
CREATE INDEX idx_scores_competition_position ON competition_scores(competition_id, final_position);
CREATE INDEX idx_scores_competition_to_par ON competition_scores(competition_id, team_score_to_par);

-- Competition payments
CREATE TABLE competition_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('main_competition', 'bounty')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(competition_id, from_user_id, to_user_id, payment_type)
);

CREATE INDEX idx_payments_competition ON competition_payments(competition_id);
CREATE INDEX idx_payments_from_user ON competition_payments(from_user_id);
CREATE INDEX idx_payments_to_user ON competition_payments(to_user_id);

-- Competition bounties
CREATE TABLE competition_bounties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  golfer_id UUID NOT NULL REFERENCES golfers(id) ON DELETE CASCADE,
  pick_round INTEGER NOT NULL CHECK (pick_round IN (1, 2, 3)),
  bounty_amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(competition_id, user_id, golfer_id)
);

CREATE INDEX idx_bounties_competition ON competition_bounties(competition_id);
CREATE INDEX idx_bounties_user ON competition_bounties(user_id);

-- Annual leaderboard
CREATE TABLE annual_leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  total_competitions INTEGER NOT NULL DEFAULT 0,
  competitions_won INTEGER NOT NULL DEFAULT 0,
  total_winnings DECIMAL(10, 2) NOT NULL DEFAULT 0,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, year)
);

CREATE INDEX idx_annual_leaderboard_year ON annual_leaderboard(year, total_winnings DESC);
CREATE INDEX idx_annual_leaderboard_user ON annual_leaderboard(user_id);

-- API usage tracking
CREATE TABLE api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL,
  data_type TEXT NOT NULL,
  day DATE NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_usage_day ON api_usage(day);
CREATE INDEX idx_api_usage_timestamp ON api_usage(timestamp);

