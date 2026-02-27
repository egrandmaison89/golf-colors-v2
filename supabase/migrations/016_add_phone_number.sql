-- Add phone_number to user_profiles for SMS draft turn notifications.
-- Stored in E.164 format: +15555551234
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS phone_number TEXT;
