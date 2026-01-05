-- Migration: Database Triggers
-- Description: Sets up triggers for updated_at timestamps
-- Run this after 001_initial_schema.sql and 002_rls_policies.sql

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_competitions_updated_at
  BEFORE UPDATE ON competitions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_competition_scores_updated_at
  BEFORE UPDATE ON competition_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_annual_leaderboard_updated_at
  BEFORE UPDATE ON annual_leaderboard
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

