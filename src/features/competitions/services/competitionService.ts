/**
 * Competition Service
 * 
 * Handles competition CRUD operations
 */

import { supabase } from '@/lib/supabase/client';
import type { Competition, CompetitionWithDetails } from '../types';

/**
 * Create a new competition
 */
export async function createCompetition(
  tournamentId: string,
  name: string,
  userId: string
): Promise<Competition> {
  // Get tournament to set pick deadline
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('start_date')
    .eq('id', tournamentId)
    .single();

  const { data, error } = await supabase
    .from('competitions')
    .insert({
      tournament_id: tournamentId,
      name,
      created_by: userId,
      pick_deadline: tournament?.start_date
        ? new Date(tournament.start_date).toISOString()
        : null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create competition: ${error.message}`);
  }

  // Auto-join creator as participant
  await supabase.from('competition_participants').insert({
    competition_id: data.id,
    user_id: userId,
  });

  return data;
}

/**
 * Get competitions for a user (competitions they're participating in)
 */
export async function getCompetitions(userId: string): Promise<CompetitionWithDetails[]> {
  // Get competitions where user is a participant
  const { data: participants, error: participantsError } = await supabase
    .from('competition_participants')
    .select('competition_id')
    .eq('user_id', userId);

  if (participantsError) {
    throw new Error(`Failed to fetch competitions: ${participantsError.message}`);
  }

  if (!participants || participants.length === 0) {
    return [];
  }

  const competitionIds = participants.map(p => p.competition_id);

  // Get competitions with tournament details
  const { data: competitions, error: competitionsError } = await supabase
    .from('competitions')
    .select(`
      *,
      tournaments (
        id,
        name,
        start_date,
        end_date,
        status
      )
    `)
    .in('id', competitionIds)
    .order('created_at', { ascending: false });

  if (competitionsError) {
    throw new Error(`Failed to fetch competitions: ${competitionsError.message}`);
  }

  // Get participant counts
  const { data: participantCounts } = await supabase
    .from('competition_participants')
    .select('competition_id')
    .in('competition_id', competitionIds);

  const countsByCompetition = new Map<string, number>();
  participantCounts?.forEach(p => {
    countsByCompetition.set(
      p.competition_id,
      (countsByCompetition.get(p.competition_id) || 0) + 1
    );
  });

  // Combine data
  return (competitions || []).map(comp => ({
    ...comp,
    tournament: Array.isArray(comp.tournaments) ? comp.tournaments[0] : comp.tournaments,
    participantCount: countsByCompetition.get(comp.id) || 0,
  })) as CompetitionWithDetails[];
}

/**
 * Get a single competition by ID with details
 */
export async function getCompetitionById(
  id: string
): Promise<CompetitionWithDetails | null> {
  // Get competition with tournament
  const { data: competition, error: compError } = await supabase
    .from('competitions')
    .select(`
      *,
      tournaments (
        id,
        name,
        start_date,
        end_date,
        status
      )
    `)
    .eq('id', id)
    .single();

  if (compError) {
    if (compError.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch competition: ${compError.message}`);
  }

  // Get participants
  const { data: participants } = await supabase
    .from('competition_participants')
    .select('*')
    .eq('competition_id', id);

  return {
    ...competition,
    tournament: Array.isArray(competition.tournaments)
      ? competition.tournaments[0]
      : competition.tournaments,
    participants: participants || [],
    participantCount: participants?.length || 0,
  } as CompetitionWithDetails;
}

/**
 * Join a competition
 */
export async function joinCompetition(
  competitionId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase.from('competition_participants').insert({
    competition_id: competitionId,
    user_id: userId,
  });

  if (error) {
    if (error.code === '23505') {
      // Unique constraint violation - already a participant
      throw new Error('You are already a participant in this competition');
    }
    throw new Error(`Failed to join competition: ${error.message}`);
  }
}

/**
 * Check if user is a participant in a competition
 */
export async function isParticipant(
  competitionId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('competition_participants')
    .select('id')
    .eq('competition_id', competitionId)
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error checking participant:', error);
    return false;
  }

  return !!data;
}

