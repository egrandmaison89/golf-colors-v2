-- Migration: Fix RLS Policy Infinite Recursion
-- Description: Fixes the infinite recursion in competition_participants RLS policy
-- Run this after 002_rls_policies.sql

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Users can view participants in their competitions" ON competition_participants;

-- Create the corrected policy that avoids recursion
-- Users can see participants if:
-- 1. They are a participant themselves (user_id = auth.uid())
-- 2. OR they created the competition (checked via competitions table, not competition_participants)
CREATE POLICY "Users can view participants in their competitions"
  ON competition_participants FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()  -- User can see their own participation record
    OR competition_id IN (
      SELECT id FROM competitions WHERE created_by = auth.uid()
    )  -- Or they created the competition (avoids recursion by checking competitions table)
  );

