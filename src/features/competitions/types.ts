/**
 * Competition types
 */

import type {
  Competition as DBCompetition,
  CompetitionParticipant as DBParticipant,
  DraftOrder as DBDraftOrder,
} from '@/types/database';

/**
 * Competition from database
 */
export type Competition = DBCompetition;

/**
 * Competition participant
 */
export type CompetitionParticipant = DBParticipant;

/**
 * Draft order entry
 */
export type DraftOrder = DBDraftOrder;

/**
 * Competition with related data
 */
export interface CompetitionWithDetails extends Competition {
  participants?: CompetitionParticipant[];
  participantCount?: number;
  tournament?: {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    status: string;
  };
}

