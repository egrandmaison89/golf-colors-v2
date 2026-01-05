/**
 * Golfer types
 */

import type { Golfer as DBGolfer } from '@/types/database';

/**
 * Golfer from database (with all fields)
 */
export type Golfer = DBGolfer;

/**
 * Golfer from SportsData.io API (before transformation)
 */
export interface SportsDataGolfer {
  PlayerID: number;
  FirstName: string;
  LastName: string;
  Country?: string;
  WorldRanking?: number;
  [key: string]: unknown; // Allow for additional fields
}

