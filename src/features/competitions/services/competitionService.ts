/**
 * Competition Service
 *
 * Handles competition CRUD operations.
 * Supports public (one per tournament) and private (invite-link) competitions.
 */

import { supabase } from '@/lib/supabase/client';
import type { Competition, CompetitionWithDetails } from '../types';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Draft auto-starts 2 days before tournament start.
 * This gives a clear window: join up to 2 days before, draft fires automatically.
 * For tournaments starting in <2 days, the draft only starts via admin override.
 */
function draftScheduledAt(tournamentStartDate: string): string {
  const d = new Date(tournamentStartDate);
  d.setDate(d.getDate() - 2);
  return d.toISOString();
}

function inviteExpiresAt(): string {
  const d = new Date();
  d.setHours(d.getHours() + 72);
  return d.toISOString();
}

// ============================================================================
// Public competition
// ============================================================================

/**
 * Get the public competition for a tournament, or create it if it doesn't exist.
 * Called when a user visits a tournament detail page.
 */
export async function getOrCreatePublicCompetition(
  tournamentId: string,
  tournamentName: string,
  tournamentStartDate: string,
  systemUserId: string // the visiting user's id — used as created_by if we must create
): Promise<CompetitionWithDetails> {
  // Try to fetch existing public competition
  const { data: existing } = await supabase
    .from('competitions')
    .select(`*, tournaments(id, name, start_date, end_date, status)`)
    .eq('tournament_id', tournamentId)
    .eq('is_public', true)
    .single();

  if (existing) {
    return enrichWithParticipantCount(existing);
  }

  // Create it
  const { data: created, error } = await supabase
    .from('competitions')
    .insert({
      tournament_id: tournamentId,
      name: `${tournamentName} — Public`,
      created_by: systemUserId,
      is_public: true,
      draft_scheduled_at: draftScheduledAt(tournamentStartDate),
    })
    .select(`*, tournaments(id, name, start_date, end_date, status)`)
    .single();

  if (error) throw new Error(`Failed to create public competition: ${error.message}`);

  return enrichWithParticipantCount(created);
}

// ============================================================================
// Private competition
// ============================================================================

/**
 * Create a new private competition with a share link invite code.
 */
export async function createPrivateCompetition(
  tournamentId: string,
  name: string,
  userId: string,
  tournamentStartDate: string
): Promise<CompetitionWithDetails> {
  // Generate invite code via DB function
  const { data: codeRow } = await supabase.rpc('generate_invite_code');
  const invite_code = codeRow as string;

  const { data, error } = await supabase
    .from('competitions')
    .insert({
      tournament_id: tournamentId,
      name,
      created_by: userId,
      is_public: false,
      invite_code,
      invite_expires_at: inviteExpiresAt(),
      draft_scheduled_at: draftScheduledAt(tournamentStartDate),
    })
    .select(`*, tournaments(id, name, start_date, end_date, status)`)
    .single();

  if (error) throw new Error(`Failed to create competition: ${error.message}`);

  // Auto-join creator
  await supabase.from('competition_participants').insert({
    competition_id: data.id,
    user_id: userId,
  });

  return enrichWithParticipantCount(data);
}

/**
 * Look up a competition by invite code.
 * Returns null if not found or expired.
 */
export async function getCompetitionByInviteCode(
  inviteCode: string
): Promise<CompetitionWithDetails | null> {
  const { data, error } = await supabase
    .from('competitions')
    .select(`*, tournaments(id, name, start_date, end_date, status)`)
    .eq('invite_code', inviteCode)
    .single();

  if (error || !data) return null;

  // Check expiry (public competitions have null invite_expires_at — no expiry)
  if (data.invite_expires_at && new Date(data.invite_expires_at) < new Date()) {
    return null; // expired
  }

  return enrichWithParticipantCount(data);
}

// ============================================================================
// Existing helpers (kept / updated)
// ============================================================================

/**
 * @deprecated Use getOrCreatePublicCompetition or createPrivateCompetition
 */
export async function createCompetition(
  tournamentId: string,
  name: string,
  userId: string
): Promise<Competition> {
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
      draft_scheduled_at: tournament?.start_date
        ? draftScheduledAt(tournament.start_date)
        : null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create competition: ${error.message}`);

  await supabase.from('competition_participants').insert({
    competition_id: data.id,
    user_id: userId,
  });

  return data;
}

/**
 * Get competitions for a user (all competitions they're participating in)
 */
export async function getCompetitions(userId: string): Promise<CompetitionWithDetails[]> {
  const { data: participants, error: participantsError } = await supabase
    .from('competition_participants')
    .select('competition_id')
    .eq('user_id', userId);

  if (participantsError) {
    throw new Error(`Failed to fetch competitions: ${participantsError.message}`);
  }

  if (!participants || participants.length === 0) return [];

  const competitionIds = participants.map((p) => p.competition_id);

  const { data: competitions, error: competitionsError } = await supabase
    .from('competitions')
    .select(`*, tournaments(id, name, start_date, end_date, status)`)
    .in('id', competitionIds)
    .order('created_at', { ascending: false });

  if (competitionsError) throw new Error(`Failed to fetch competitions: ${competitionsError.message}`);

  const { data: participantCounts } = await supabase
    .from('competition_participants')
    .select('competition_id')
    .in('competition_id', competitionIds);

  const countsByCompetition = new Map<string, number>();
  participantCounts?.forEach((p) => {
    countsByCompetition.set(p.competition_id, (countsByCompetition.get(p.competition_id) || 0) + 1);
  });

  return (competitions || []).map((comp) => ({
    ...comp,
    tournament: Array.isArray(comp.tournaments) ? comp.tournaments[0] : comp.tournaments,
    participantCount: countsByCompetition.get(comp.id) || 0,
  })) as CompetitionWithDetails[];
}

/**
 * Get a single competition by ID with details
 */
export async function getCompetitionById(id: string): Promise<CompetitionWithDetails | null> {
  const { data: competition, error: compError } = await supabase
    .from('competitions')
    .select(`*, tournaments(id, name, start_date, end_date, status)`)
    .eq('id', id)
    .single();

  if (compError) {
    if (compError.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch competition: ${compError.message}`);
  }

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
export async function joinCompetition(competitionId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('competition_participants').insert({
    competition_id: competitionId,
    user_id: userId,
  });

  if (error) {
    if (error.code === '23505') throw new Error('You are already a participant in this competition');
    throw new Error(`Failed to join competition: ${error.message}`);
  }
}

/**
 * Check if user is a participant in a competition
 */
export async function isParticipant(competitionId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('competition_participants')
    .select('id')
    .eq('competition_id', competitionId)
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') return false;
  return !!data;
}

/**
 * Check if current user is an admin
 */
export async function getIsAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', userId)
    .single();

  return data?.is_admin === true;
}

/**
 * Auto-start draft if draft_scheduled_at has passed and conditions are met.
 * Returns true if draft was started.
 *
 * Safety guard: never auto-start if tournament begins in <24h (admin-only at that point).
 */
export async function maybeAutoStartDraft(competition: CompetitionWithDetails): Promise<boolean> {
  if (competition.draft_status !== 'not_started') return false;
  if (!competition.draft_scheduled_at) return false;
  if (new Date(competition.draft_scheduled_at) > new Date()) return false;
  if ((competition.participantCount ?? 0) < 2) return false;

  // Guard: don't auto-start within 24h of tournament (requires admin override)
  if (competition.tournament?.start_date) {
    const tournamentStart = new Date(competition.tournament.start_date);
    const hoursUntilStart = (tournamentStart.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilStart < 24) return false;
  }

  // Start draft: shuffle participants into draft_order
  const { data: participants } = await supabase
    .from('competition_participants')
    .select('user_id')
    .eq('competition_id', competition.id);

  if (!participants || participants.length < 2) return false;

  // Fisher-Yates shuffle
  const shuffled = [...participants];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const orderEntries = shuffled.map((p, i) => ({
    competition_id: competition.id,
    user_id: p.user_id,
    position: i + 1,
  }));

  const { error: orderError } = await supabase.from('draft_order').insert(orderEntries);
  if (orderError) return false;

  const { error: updateError } = await supabase
    .from('competitions')
    .update({ draft_status: 'in_progress', draft_started_at: new Date().toISOString() })
    .eq('id', competition.id);

  return !updateError;
}

// ============================================================================
// Internal
// ============================================================================

async function enrichWithParticipantCount(comp: Competition & { tournaments?: unknown }): Promise<CompetitionWithDetails> {
  const { data: participants } = await supabase
    .from('competition_participants')
    .select('user_id')
    .eq('competition_id', comp.id);

  return {
    ...comp,
    tournament: Array.isArray((comp as any).tournaments)
      ? (comp as any).tournaments[0]
      : (comp as any).tournaments,
    participants: participants ?? [],
    participantCount: participants?.length ?? 0,
  } as CompetitionWithDetails;
}
