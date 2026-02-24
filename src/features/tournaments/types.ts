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
 * Tournament leaderboard entry from SportsData.io API
 */
export interface SportsDataLeaderboardEntry {
  PlayerID: number;
  Position?: number;
  TotalStrokes?: number;
  TotalScore?: number; // Relative to par
  Rounds?: Array<{
    Round: number;
    Score: number;
    ToPar?: number;
  }>;
  Earnings?: number;
  MadeCut?: boolean;
  Withdrew?: boolean;
  [key: string]: unknown;
}

