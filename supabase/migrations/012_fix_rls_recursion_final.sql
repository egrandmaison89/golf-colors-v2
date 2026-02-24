-- Migration 012: Fix RLS mutual recursion permanently
--
-- Root cause: competitions policy queries competition_participants,
-- and competition_participants policy queries competitions → infinite loop.
--
-- Fix: Create a SECURITY DEFINER function that reads competition_participants
-- without triggering RLS, then use it in all affected policies.

-- Security definer function: returns competition_ids the user belongs to
-- SECURITY DEFINER bypasses RLS on competition_participants, breaking the cycle
CREATE OR REPLACE FUNCTION public.user_competition_ids(uid uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT competition_id FROM competition_participants WHERE user_id = uid
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.user_competition_ids(uuid) TO authenticated;

-- ============================================================================
-- Re-create all affected policies using the function instead of subqueries
-- ============================================================================

-- competitions
DROP POLICY IF EXISTS "Users can view competitions they participate in" ON competitions;
CREATE POLICY "Users can view competitions they participate in"
  ON competitions FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR id IN (SELECT public.user_competition_ids(auth.uid()))
  );

-- competition_participants (break the other side of the cycle too)
DROP POLICY IF EXISTS "Users can view participants in their competitions" ON competition_participants;
CREATE POLICY "Users can view participants in their competitions"
  ON competition_participants FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR competition_id IN (SELECT id FROM competitions WHERE created_by = auth.uid())
  );

-- draft_order
DROP POLICY IF EXISTS "Users can view draft order in their competitions" ON draft_order;
CREATE POLICY "Users can view draft order in their competitions"
  ON draft_order FOR SELECT TO authenticated
  USING (competition_id IN (SELECT public.user_competition_ids(auth.uid())));

-- draft_picks
DROP POLICY IF EXISTS "Users can view draft picks in their competitions" ON draft_picks;
CREATE POLICY "Users can view draft picks in their competitions"
  ON draft_picks FOR SELECT TO authenticated
  USING (competition_id IN (SELECT public.user_competition_ids(auth.uid())));

-- alternates
DROP POLICY IF EXISTS "Users can view alternates in their competitions" ON alternates;
CREATE POLICY "Users can view alternates in their competitions"
  ON alternates FOR SELECT TO authenticated
  USING (competition_id IN (SELECT public.user_competition_ids(auth.uid())));

-- competition_scores
DROP POLICY IF EXISTS "Users can view scores in their competitions" ON competition_scores;
CREATE POLICY "Users can view scores in their competitions"
  ON competition_scores FOR SELECT TO authenticated
  USING (competition_id IN (SELECT public.user_competition_ids(auth.uid())));

-- competition_payments
DROP POLICY IF EXISTS "Users can view payments in their competitions" ON competition_payments;
CREATE POLICY "Users can view payments in their competitions"
  ON competition_payments FOR SELECT TO authenticated
  USING (competition_id IN (SELECT public.user_competition_ids(auth.uid())));

-- competition_bounties
DROP POLICY IF EXISTS "Users can view bounties in their competitions" ON competition_bounties;
CREATE POLICY "Users can view bounties in their competitions"
  ON competition_bounties FOR SELECT TO authenticated
  USING (competition_id IN (SELECT public.user_competition_ids(auth.uid())));

-- INSERT policies that had the same pattern
DROP POLICY IF EXISTS "Users can insert bounties in their competitions" ON competition_bounties;
CREATE POLICY "Users can insert bounties in their competitions"
  ON competition_bounties FOR INSERT TO authenticated
  WITH CHECK (competition_id IN (SELECT public.user_competition_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can insert payments in their competitions" ON competition_payments;
CREATE POLICY "Users can insert payments in their competitions"
  ON competition_payments FOR INSERT TO authenticated
  WITH CHECK (competition_id IN (SELECT public.user_competition_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can insert scores in their competitions" ON competition_scores;
CREATE POLICY "Users can insert scores in their competitions"
  ON competition_scores FOR INSERT TO authenticated
  WITH CHECK (competition_id IN (SELECT public.user_competition_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update scores in their competitions" ON competition_scores;
CREATE POLICY "Users can update scores in their competitions"
  ON competition_scores FOR UPDATE TO authenticated
  USING (competition_id IN (SELECT public.user_competition_ids(auth.uid())));
