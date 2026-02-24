-- Migration: RLS policies for tournaments and golfers cache
-- Description: Allow authenticated users to insert/update cached API data
-- These tables are populated from SportsData.io API; RLS previously only allowed SELECT.

-- Tournaments: Allow insert/update for API cache (upsert by sportsdata_id)
CREATE POLICY "Authenticated users can insert tournaments"
  ON tournaments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update tournaments"
  ON tournaments FOR UPDATE
  TO authenticated
  USING (true);

-- Golfers: Allow insert/update for API cache (upsert by sportsdata_id)
CREATE POLICY "Authenticated users can insert golfers"
  ON golfers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update golfers"
  ON golfers FOR UPDATE
  TO authenticated
  USING (true);
