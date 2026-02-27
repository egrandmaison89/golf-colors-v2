/**
 * Tournament types
 */

import type { Tournament as DBTournament } from '@/types/database';

/**
 * Tournament from database (with all fields)
 */
export type Tournament = DBTournament;

/**
 * Tournament status
 */
export type TournamentStatus = 'upcoming' | 'active' | 'completed';

/**
 * Tournament from SportsData.io API (before transformation)
 * This structure may differ from our database schema
 */
export interface SportsDataTournament {
  TournamentID: number;
  Name: string;
  StartDate: string;
  EndDate: string;
  Course?: string;
  Venue?: string; // Some API versions use Venue instead of Course
  Purse?: number;
  [key: string]: unknown; // Allow for additional fields
}

/**
 * Tournament leaderboard entry from SportsData.io Golf v2 API.
 *
 * IMPORTANT field notes (verified against live API):
 *   - `Rank`        : integer position (NOT `Position` — Position is always null)
 *   - `TotalScore`  : DFS fantasy decimal (e.g. -11.3) — NOT real golf to-par
 *   - `TotalStrokes`: DFS fantasy decimal (e.g. 77.6)  — NOT real stroke count
 *   - `IsWithdrawn` : boolean withdrawal flag (NOT `Withdrew`)
 *   - `TotalThrough`: holes played today (may be null pre-tournament)
 *   - `MadeCut`     : DFS probability decimal — NOT a boolean
 *   - Real to-par   : sum Rounds[].Holes[].ToPar for each played hole
 *   - Real strokes  : sum Rounds[].Holes[].Score for each played hole
 */
export interface SportsDataLeaderboardEntry {
  PlayerID: number;
  Name?: string;
  Rank?: number;
  TotalScore?: number;       // DFS fantasy — do NOT use as golf to-par
  TotalStrokes?: number;     // DFS fantasy — do NOT use as stroke count
  TotalThrough?: number | null;
  MadeCut?: number | null;   // DFS probability decimal (not boolean)
  IsWithdrawn?: boolean;
  IsAlternate?: boolean;
  Rounds?: Array<{
    Number?: number;
    ToPar?: number | null;  // round-level to-par summary (real value, not DFS)
    Score?: number | null;  // round-level stroke total (real value, not DFS)
    Holes?: Array<{
      Number?: number;
      ToPar?: number | null;  // actual integer to-par per hole
      Score?: number | null;  // actual stroke count per hole
    }>;
  }>;
  Earnings?: number;
  [key: string]: unknown;
}

