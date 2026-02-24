-- Migration: Backfill User Profiles and Auto-Create for New Users
-- Description: Ensures all users have user_profiles entries and creates them automatically for new users
-- Run this after 001_initial_schema.sql

-- 1. Backfill user_profiles for existing users who don't have one
INSERT INTO user_profiles (id, created_at, updated_at)
SELECT 
  id,
  created_at,
  created_at
FROM auth.users
WHERE id NOT IN (SELECT id FROM user_profiles)
ON CONFLICT (id) DO NOTHING;

-- 2. Create function to auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.created_at,
    NEW.created_at
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create trigger to call function when new user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

