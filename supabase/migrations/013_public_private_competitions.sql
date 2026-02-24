-- Migration 013: Public/Private competitions + admin + scheduled draft
--
-- Adds:
--   competitions.is_public         — true = auto-created public competition for tournament
--   competitions.invite_code       — random token for share links (private only)
--   competitions.invite_expires_at — 72h expiry for invite links (null = never)
--   competitions.draft_scheduled_at — when draft auto-starts (default: tournament start - 4 days)
--   user_profiles.is_admin         — admin flag, manually set

-- ============================================================================
-- competitions table: new columns
-- ============================================================================

ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS draft_scheduled_at TIMESTAMPTZ;

-- Unique constraint: only one public competition per tournament
CREATE UNIQUE INDEX IF NOT EXISTS competitions_one_public_per_tournament
  ON competitions (tournament_id)
  WHERE is_public = true;

-- ============================================================================
-- user_profiles table: is_admin column
-- ============================================================================

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- RLS: public competitions visible to all authenticated users
-- ============================================================================

-- Drop existing competitions SELECT policy (uses security definer fn now)
DROP POLICY IF EXISTS "Users can view competitions they participate in" ON competitions;

-- New policy: can see public competitions OR ones they created/joined
CREATE POLICY "Users can view competitions they participate in"
  ON competitions FOR SELECT TO authenticated
  USING (
    is_public = true
    OR created_by = auth.uid()
    OR id IN (SELECT public.user_competition_ids(auth.uid()))
  );

-- ============================================================================
-- Function: generate a random invite code (8 chars, alphanumeric)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT string_agg(
    substr('abcdefghijkmnpqrstuvwxyz23456789', ceil(random() * 32)::int, 1),
    ''
  )
  FROM generate_series(1, 8)
$$;

-- ============================================================================
-- Backfill: set draft_scheduled_at for existing competitions that don't have it
-- ============================================================================

UPDATE competitions c
SET draft_scheduled_at = (
  SELECT (t.start_date::timestamptz - interval '4 days')
  FROM tournaments t
  WHERE t.id = c.tournament_id
)
WHERE c.draft_scheduled_at IS NULL;
