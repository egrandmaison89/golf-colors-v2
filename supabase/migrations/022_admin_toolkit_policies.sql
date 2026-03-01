-- Migration 022: Admin Toolkit — RLS policies + manual_override column
--
-- Adds:
--   1. is_admin_user() SECURITY DEFINER helper (avoids repeating subquery)
--   2. tournament_results.manual_override column (preserves admin edits during API sync)
--   3. Admin RLS policies for: draft_picks, alternates, competitions, competition_scores,
--      competition_payments, competition_bounties, annual_leaderboard, draft_order

-- ============================================================================
-- 1. SECURITY DEFINER helper: is_admin_user(uid)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin_user(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM user_profiles WHERE id = uid),
    false
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_user(uuid) TO authenticated;

-- ============================================================================
-- 2. manual_override column on tournament_results
-- ============================================================================

ALTER TABLE tournament_results
  ADD COLUMN IF NOT EXISTS manual_override BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- 3. draft_picks: Admin UPDATE + DELETE (edit/reset team selections)
-- ============================================================================

CREATE POLICY "Admins can update draft picks"
  ON draft_picks FOR UPDATE TO authenticated
  USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can delete draft picks"
  ON draft_picks FOR DELETE TO authenticated
  USING (public.is_admin_user(auth.uid()));

-- ============================================================================
-- 4. alternates: Admin INSERT + UPDATE + DELETE (edit/reset alternates)
-- ============================================================================

CREATE POLICY "Admins can insert alternates for any user"
  ON alternates FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can update alternates for any user"
  ON alternates FOR UPDATE TO authenticated
  USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can delete alternates"
  ON alternates FOR DELETE TO authenticated
  USING (public.is_admin_user(auth.uid()));

-- ============================================================================
-- 5. competitions: Extend SELECT + UPDATE to include admins
-- ============================================================================

-- Replace SELECT to add admin visibility
DROP POLICY IF EXISTS "Users can view competitions they participate in" ON competitions;
CREATE POLICY "Users can view competitions they participate in"
  ON competitions FOR SELECT TO authenticated
  USING (
    is_public = true
    OR created_by = auth.uid()
    OR id IN (SELECT public.user_competition_ids(auth.uid()))
    OR public.is_admin_user(auth.uid())
  );

-- Replace UPDATE to add admin capability
DROP POLICY IF EXISTS "Competition creators can update their competitions" ON competitions;
CREATE POLICY "Competition creators can update their competitions"
  ON competitions FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_admin_user(auth.uid())
  );

-- ============================================================================
-- 6. competition_scores: Admin DELETE (for reset finalization)
-- ============================================================================

CREATE POLICY "Admins can delete competition scores"
  ON competition_scores FOR DELETE TO authenticated
  USING (public.is_admin_user(auth.uid()));

-- ============================================================================
-- 7. competition_payments: Admin DELETE (for reset finalization)
-- ============================================================================

CREATE POLICY "Admins can delete competition payments"
  ON competition_payments FOR DELETE TO authenticated
  USING (public.is_admin_user(auth.uid()));

-- ============================================================================
-- 8. competition_bounties: Admin DELETE (for reset finalization)
-- ============================================================================

CREATE POLICY "Admins can delete competition bounties"
  ON competition_bounties FOR DELETE TO authenticated
  USING (public.is_admin_user(auth.uid()));

-- ============================================================================
-- 9. annual_leaderboard: Admin UPDATE + DELETE (for reversing finalization)
-- ============================================================================

CREATE POLICY "Admins can update annual leaderboard entries"
  ON annual_leaderboard FOR UPDATE TO authenticated
  USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can delete annual leaderboard entries"
  ON annual_leaderboard FOR DELETE TO authenticated
  USING (public.is_admin_user(auth.uid()));

-- ============================================================================
-- 10. draft_order: Admin DELETE (for reset draft)
-- ============================================================================

CREATE POLICY "Admins can delete draft order"
  ON draft_order FOR DELETE TO authenticated
  USING (public.is_admin_user(auth.uid()));

-- ============================================================================
-- 11. competition_participants: Admin DELETE (for removing participants)
-- ============================================================================

CREATE POLICY "Admins can delete competition participants"
  ON competition_participants FOR DELETE TO authenticated
  USING (public.is_admin_user(auth.uid()));
