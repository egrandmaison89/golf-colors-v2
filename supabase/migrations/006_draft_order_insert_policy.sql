-- Migration: Allow competition creator to insert draft order when starting draft
-- Description: Adds INSERT policy for draft_order - only competition creator can start draft

CREATE POLICY "Competition creators can create draft order"
  ON draft_order FOR INSERT
  TO authenticated
  WITH CHECK (
    competition_id IN (
      SELECT id FROM competitions WHERE created_by = auth.uid()
    )
  );
