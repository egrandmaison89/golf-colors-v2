-- Migration 019: Add total_bounties column to annual_leaderboard
--
-- Separates bounty net earnings from main competition net earnings so
-- the Annual Leaderboard can display them as distinct columns.
--
-- total_winnings = net main competition payments (received - paid)
-- total_bounties = net bounty payments (received - paid)

ALTER TABLE annual_leaderboard
  ADD COLUMN IF NOT EXISTS total_bounties DECIMAL(10,2) NOT NULL DEFAULT 0;
