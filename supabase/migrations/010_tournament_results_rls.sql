-- Migration 010: Tournament Results RLS Policies
-- Allows authenticated users to insert/update tournament_results (for caching live API data)

-- Allow authenticated users to read tournament results (may already exist from migration 002, idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tournament_results'
    AND policyname = 'Authenticated users can read tournament results'
  ) THEN
    CREATE POLICY "Authenticated users can read tournament results"
      ON tournament_results FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Allow authenticated users to insert tournament results (for syncTournamentResults)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tournament_results'
    AND policyname = 'Authenticated users can insert tournament results'
  ) THEN
    CREATE POLICY "Authenticated users can insert tournament results"
      ON tournament_results FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- Allow authenticated users to update tournament results (for upsert syncing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tournament_results'
    AND policyname = 'Authenticated users can update tournament results'
  ) THEN
    CREATE POLICY "Authenticated users can update tournament results"
      ON tournament_results FOR UPDATE TO authenticated USING (true);
  END IF;
END $$;
