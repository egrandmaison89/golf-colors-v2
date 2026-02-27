-- Migration 018: Allow admin users to insert draft_order rows
--
-- Previously only the competition creator (created_by = auth.uid()) could insert
-- draft_order rows, blocking admin users from starting drafts via the admin UI.
--
-- Fix: extend the INSERT policy to also allow users with is_admin = true.

DROP POLICY IF EXISTS "Competition creators can create draft order" ON draft_order;

CREATE POLICY "Competition creators can create draft order"
  ON draft_order FOR INSERT TO authenticated
  WITH CHECK (
    competition_id IN (SELECT id FROM competitions WHERE created_by = auth.uid())
    OR (SELECT is_admin FROM user_profiles WHERE id = auth.uid()) = true
  );
