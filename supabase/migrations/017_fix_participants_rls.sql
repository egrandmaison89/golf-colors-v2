-- Migration 017: Fix competition_participants RLS so all members of a competition
-- can see each other's participant rows.
--
-- Previous policy only allowed users to see their own row OR rows in competitions
-- they created. This caused:
--   1. participantCount always showing 1 for non-creators
--   2. Draft picks / alternates queries working but participant-based UI broken
--
-- Fix: use the existing SECURITY DEFINER helper (user_competition_ids) so any
-- participant can see all rows for competitions they belong to.
-- This is the same pattern already used for draft_order, draft_picks, alternates, etc.

DROP POLICY IF EXISTS "Users can view participants in their competitions" ON competition_participants;

CREATE POLICY "Users can view participants in their competitions"
  ON competition_participants FOR SELECT TO authenticated
  USING (
    competition_id IN (SELECT public.user_competition_ids(auth.uid()))
    OR user_id = auth.uid()
  );
