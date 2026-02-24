/**
 * Draft Service
 *
 * Handles draft operations for competitions: start draft, make picks, select alternates.
 * Implements snake draft: Round 1 (1->N), Round 2 (N->1), Round 3 (1->N).
 */

import { supabase } from '@/lib/supabase/client';
import type { DraftOrder, DraftPick } from '@/types/database';

export interface DraftOrderWithUser extends DraftOrder {
  user_email?: string;
}

export interface DraftPickWithGolfer extends DraftPick {
  golfer?: {
    id: string;
    display_name: string;
    world_ranking: number | null;
  };
}

/**
 * Get draft order for a competition, ordered by position
 */
export async function getDraftOrder(
  competitionId: string
): Promise<DraftOrderWithUser[]> {
  const { data, error } = await supabase
    .from('draft_order')
    .select('*')
    .eq('competition_id', competitionId)
    .order('position', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch draft order: ${error.message}`);
  }

  return data || [];
}

/**
 * Get draft picks for a competition with golfer details
 */
export async function getDraftPicks(
  competitionId: string
): Promise<DraftPickWithGolfer[]> {
  const { data, error } = await supabase
    .from('draft_picks')
    .select(
      `
      *,
      golfers (
        id,
        display_name,
        world_ranking
      )
    `
    )
    .eq('competition_id', competitionId)
    .order('pick_number', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch draft picks: ${error.message}`);
  }

  return (data || []).map((pick) => ({
    ...pick,
    golfer: Array.isArray(pick.golfers) ? pick.golfers[0] : pick.golfers,
  })) as DraftPickWithGolfer[];
}

/**
 * Get alternates for a competition
 */
export async function getAlternates(competitionId: string) {
  const { data, error } = await supabase
    .from('alternates')
    .select(
      `
      *,
      golfers (
        id,
        display_name
      )
    `
    )
    .eq('competition_id', competitionId);

  if (error) {
    throw new Error(`Failed to fetch alternates: ${error.message}`);
  }

  return (data || []).map((alt) => ({
    ...alt,
    golfer: Array.isArray(alt.golfers) ? alt.golfers[0] : alt.golfers,
  }));
}

/**
 * Compute whose turn it is for the next pick (snake draft)
 * position 1 = first pick, position N = last pick
 */
function getPositionForPickNumber(pickNumber: number, participantCount: number): number {
  const round = Math.ceil(pickNumber / participantCount);
  const indexInRound = (pickNumber - 1) % participantCount;
  if (round % 2 === 1) {
    return indexInRound + 1;
  }
  return participantCount - indexInRound;
}

/**
 * Get whose turn it is for the next pick
 */
export async function getCurrentTurn(
  competitionId: string
): Promise<{ userId: string | null; pickNumber: number }> {
  const [order, picks] = await Promise.all([
    getDraftOrder(competitionId),
    getDraftPicks(competitionId),
  ]);

  const nextPickNumber = picks.length + 1;
  const totalPicks = order.length * 3;
  if (order.length === 0 || nextPickNumber > totalPicks) {
    return { userId: null, pickNumber: nextPickNumber };
  }

  const position = getPositionForPickNumber(nextPickNumber, order.length);
  const orderEntry = order.find((o) => o.position === position);
  return {
    userId: orderEntry?.user_id ?? null,
    pickNumber: nextPickNumber,
  };
}

/**
 * Get the user_id whose turn it is for the next pick (internal use)
 */
async function getCurrentTurnUserId(competitionId: string): Promise<string | null> {
  const [order, picks] = await Promise.all([
    getDraftOrder(competitionId),
    getDraftPicks(competitionId),
  ]);

  if (order.length === 0) return null;

  const nextPickNumber = picks.length + 1;
  const totalPicks = order.length * 3; // 3 rounds
  if (nextPickNumber > totalPicks) return null; // Draft complete

  const position = getPositionForPickNumber(nextPickNumber, order.length);
  const orderEntry = order.find((o) => o.position === position);
  return orderEntry?.user_id ?? null;
}

/**
 * Start the draft - creates random draft order. Creator only.
 */
export async function startDraft(
  competitionId: string,
  userId: string
): Promise<void> {
  // Verify user is creator
  const { data: competition, error: compError } = await supabase
    .from('competitions')
    .select('created_by, draft_status')
    .eq('id', competitionId)
    .single();

  if (compError) {
    throw new Error(`Failed to fetch competition: ${compError.message}`);
  }
  if (competition.created_by !== userId) {
    throw new Error('Only the competition creator can start the draft');
  }
  if (competition.draft_status !== 'not_started') {
    throw new Error('Draft has already been started');
  }

  // Get participants
  const { data: participants, error: partError } = await supabase
    .from('competition_participants')
    .select('user_id')
    .eq('competition_id', competitionId);

  if (partError || !participants || participants.length < 2) {
    throw new Error('Need at least 2 participants to start the draft');
  }

  // Shuffle for random order (Fisher-Yates)
  const shuffled = [...participants];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Create draft order
  const orderEntries = shuffled.map((p, i) => ({
    competition_id: competitionId,
    user_id: p.user_id,
    position: i + 1,
  }));

  const { error: orderError } = await supabase.from('draft_order').insert(orderEntries);

  if (orderError) {
    throw new Error(`Failed to create draft order: ${orderError.message}`);
  }

  // Update competition status
  const { error: updateError } = await supabase
    .from('competitions')
    .update({
      draft_status: 'in_progress',
      draft_started_at: new Date().toISOString(),
    })
    .eq('id', competitionId);

  if (updateError) {
    throw new Error(`Failed to update draft status: ${updateError.message}`);
  }
}

/**
 * Make a draft pick. Validates turn, golfer availability, tournament not started.
 */
export async function makePick(
  competitionId: string,
  userId: string,
  golferId: string
): Promise<void> {
  // Verify competition state
  const { data: competition, error: compError } = await supabase
    .from('competitions')
    .select('draft_status, tournament_id, tournaments(start_date)')
    .eq('id', competitionId)
    .single();

  if (compError) {
    throw new Error(`Failed to fetch competition: ${compError.message}`);
  }
  if (competition.draft_status !== 'in_progress') {
    throw new Error('Draft is not in progress');
  }

  const raw = competition as unknown as { tournaments?: { start_date: string } | { start_date: string }[] };
  const t = raw.tournaments;
  const startDate = Array.isArray(t) ? t[0]?.start_date : t?.start_date;
  if (startDate && new Date(startDate) <= new Date()) {
    throw new Error('Tournament has already started - no more picks allowed');
  }

  // Verify it's user's turn
  const currentTurnUserId = await getCurrentTurnUserId(competitionId);
  if (currentTurnUserId !== userId) {
    throw new Error("It's not your turn to pick");
  }

  // Verify golfer not already picked
  const { data: existingPick } = await supabase
    .from('draft_picks')
    .select('id')
    .eq('competition_id', competitionId)
    .eq('golfer_id', golferId)
    .single();

  if (existingPick) {
    throw new Error('This golfer has already been selected');
  }

  // Get current picks to determine draft_round and pick_number
  const picks = await getDraftPicks(competitionId);
  const order = await getDraftOrder(competitionId);
  const nextPickNumber = picks.length + 1;
  const draftRound = Math.ceil(nextPickNumber / order.length) as 1 | 2 | 3;

  const { error: insertError } = await supabase.from('draft_picks').insert({
    competition_id: competitionId,
    user_id: userId,
    golfer_id: golferId,
    draft_round: draftRound,
    pick_number: nextPickNumber,
  });

  if (insertError) {
    throw new Error(`Failed to make pick: ${insertError.message}`);
  }

  // Check if draft is complete
  const totalPicks = order.length * 3;
  if (nextPickNumber >= totalPicks) {
    await supabase
      .from('competitions')
      .update({
        draft_status: 'completed',
        draft_completed_at: new Date().toISOString(),
      })
      .eq('id', competitionId);
  }
}

/**
 * Select an alternate. Available after draft completes, before tournament starts.
 */
export async function selectAlternate(
  competitionId: string,
  userId: string,
  golferId: string
): Promise<void> {
  // Verify user is participant
  const { data: participant } = await supabase
    .from('competition_participants')
    .select('id')
    .eq('competition_id', competitionId)
    .eq('user_id', userId)
    .single();

  if (!participant) {
    throw new Error('You must be a participant to select an alternate');
  }

  // Verify draft is completed
  const { data: competition, error: compError } = await supabase
    .from('competitions')
    .select('draft_status, tournament_id, tournaments(start_date)')
    .eq('id', competitionId)
    .single();

  if (compError) {
    throw new Error(`Failed to fetch competition: ${compError.message}`);
  }
  if (competition.draft_status !== 'completed') {
    throw new Error('Draft must be completed before selecting an alternate');
  }

  const raw = competition as unknown as { tournaments?: { start_date: string } | { start_date: string }[] };
  const t = raw.tournaments;
  const startDate = Array.isArray(t) ? t[0]?.start_date : t?.start_date;
  if (startDate && new Date(startDate) <= new Date()) {
    throw new Error('Tournament has already started');
  }

  // Verify golfer not already picked by anyone in this competition
  const { data: existingPick } = await supabase
    .from('draft_picks')
    .select('id')
    .eq('competition_id', competitionId)
    .eq('golfer_id', golferId)
    .single();

  if (existingPick) {
    throw new Error('This golfer was already drafted in this competition');
  }

  const { error } = await supabase.from('alternates').upsert(
    {
      competition_id: competitionId,
      user_id: userId,
      golfer_id: golferId,
    },
    { onConflict: 'competition_id,user_id' }
  );

  if (error) {
    throw new Error(`Failed to select alternate: ${error.message}`);
  }
}
