-- Migration 015: Add team_color to user_profiles
-- Users can choose a team color: yellow, red, green, or blue
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS team_color TEXT CHECK (team_color IN ('yellow', 'red', 'green', 'blue'));
COMMENT ON COLUMN user_profiles.team_color IS 'Team color chosen by user: yellow, red, green, or blue';
