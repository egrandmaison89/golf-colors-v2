-- Migration 011: Fix all missing RLS policies
-- Adds INSERT/UPDATE policies for tables that only had SELECT policies,
-- and fills in any other gaps found during review.

-- ============================================================================
-- competition_bounties: allow participants to insert
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'competition_bounties'
    AND policyname = 'Users can insert bounties in their competitions'
  ) THEN
    CREATE POLICY "Users can insert bounties in their competitions"
      ON competition_bounties FOR INSERT TO authenticated
      WITH CHECK (
        competition_id IN (
          SELECT competition_id FROM competition_participants WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================================================
-- competition_payments: allow participants to insert
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'competition_payments'
    AND policyname = 'Users can insert payments in their competitions'
  ) THEN
    CREATE POLICY "Users can insert payments in their competitions"
      ON competition_payments FOR INSERT TO authenticated
      WITH CHECK (
        competition_id IN (
          SELECT competition_id FROM competition_participants WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================================================
-- api_usage: allow authenticated users to insert (tracking calls)
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'api_usage'
    AND policyname = 'Authenticated users can insert API usage'
  ) THEN
    CREATE POLICY "Authenticated users can insert API usage"
      ON api_usage FOR INSERT TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- ============================================================================
-- competition_scores: allow participants to insert/update scores
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'competition_scores'
    AND policyname = 'Users can insert scores in their competitions'
  ) THEN
    CREATE POLICY "Users can insert scores in their competitions"
      ON competition_scores FOR INSERT TO authenticated
      WITH CHECK (
        competition_id IN (
          SELECT competition_id FROM competition_participants WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'competition_scores'
    AND policyname = 'Users can update scores in their competitions'
  ) THEN
    CREATE POLICY "Users can update scores in their competitions"
      ON competition_scores FOR UPDATE TO authenticated
      USING (
        competition_id IN (
          SELECT competition_id FROM competition_participants WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================================================
-- annual_leaderboard: allow authenticated users to insert/update
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'annual_leaderboard'
    AND policyname = 'Authenticated users can insert annual leaderboard'
  ) THEN
    CREATE POLICY "Authenticated users can insert annual leaderboard"
      ON annual_leaderboard FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'annual_leaderboard'
    AND policyname = 'Authenticated users can update annual leaderboard'
  ) THEN
    CREATE POLICY "Authenticated users can update annual leaderboard"
      ON annual_leaderboard FOR UPDATE TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;
