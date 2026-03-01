/**
 * Admin Service
 *
 * Provides super-user operations for competition management.
 * All functions validate the caller is an admin via getIsAdmin().
 * RLS policies (migration 022) enforce admin access at the database level.
 */

import { supabase } from '@/lib/supabase/client';
import { getIsAdmin } from './competitionService';

// ============================================================================
// Helpers
// ============================================================================

async function requireAdmin(userId: string): Promise<void> {
  const admin = await getIsAdmin(userId);
  if (!admin) throw new Error('Admin access required');
}

// ============================================================================
// 1. Swap a draft pick (change which golfer is on a team)
// ============================================================================

export async function adminSwapDraftPick(
  adminId: string,
  competitionId: string,
  pickId: string,
  newGolferId: string
): Promise<{ oldGolferId: string; newGolferId: string }> {
  await requireAdmin(adminId);

  // Fetch the existing pick
  const { data: pick, error: pickError } = await supabase
    .from('draft_picks')
    .select('id, golfer_id, user_id')
    .eq('id', pickId)
    .eq('competition_id', competitionId)
    .single();

  if (pickError || !pick) throw new Error('Draft pick not found');

  const oldGolferId = pick.golfer_id;

  // Validate new golfer isn't already drafted by someone else in this competition
  const { data: existingPick } = await supabase
    .from('draft_picks')
    .select('id')
    .eq('competition_id', competitionId)
    .eq('golfer_id', newGolferId)
    .maybeSingle();

  if (existingPick) throw new Error('This golfer is already drafted in this competition');

  // Update the pick
  const { error: updateError } = await supabase
    .from('draft_picks')
    .update({ golfer_id: newGolferId })
    .eq('id', pickId);

  if (updateError) throw new Error(`Failed to update pick: ${updateError.message}`);

  return { oldGolferId, newGolferId };
}

// ============================================================================
// 2. Update an alternate for any user
// ============================================================================

export async function adminUpdateAlternate(
  adminId: string,
  competitionId: string,
  targetUserId: string,
  newGolferId: string
): Promise<void> {
  await requireAdmin(adminId);

  // Validate golfer isn't already drafted
  const { data: existingPick } = await supabase
    .from('draft_picks')
    .select('id')
    .eq('competition_id', competitionId)
    .eq('golfer_id', newGolferId)
    .maybeSingle();

  if (existingPick) throw new Error('This golfer is already drafted in this competition');

  const { error } = await supabase.from('alternates').upsert(
    {
      competition_id: competitionId,
      user_id: targetUserId,
      golfer_id: newGolferId,
    },
    { onConflict: 'competition_id,user_id' }
  );

  if (error) throw new Error(`Failed to update alternate: ${error.message}`);
}

// ============================================================================
// 3. Edit tournament result (manual override)
// ============================================================================

export interface TournamentResultEdits {
  total_to_par?: number | null;
  made_cut?: boolean | null;
  withdrew?: boolean | null;
  position?: number | null;
}

export async function adminEditTournamentResult(
  adminId: string,
  tournamentId: string,
  golferId: string,
  updates: TournamentResultEdits
): Promise<void> {
  await requireAdmin(adminId);

  const { error } = await supabase
    .from('tournament_results')
    .update({
      ...updates,
      manual_override: true,
      last_updated: new Date().toISOString(),
    })
    .eq('tournament_id', tournamentId)
    .eq('golfer_id', golferId);

  if (error) throw new Error(`Failed to update tournament result: ${error.message}`);
}

// ============================================================================
// 4. Force sync tournament results from API
// ============================================================================

export async function adminForceSyncResults(
  adminId: string,
  competitionId: string,
  clearOverrides: boolean = false
): Promise<void> {
  await requireAdmin(adminId);

  // Get competition's tournament info
  const { data: competition, error: compError } = await supabase
    .from('competitions')
    .select('tournament_id')
    .eq('id', competitionId)
    .single();

  if (compError || !competition) throw new Error('Competition not found');

  const { data: tournament, error: tError } = await supabase
    .from('tournaments')
    .select('id, sportsdata_id')
    .eq('id', competition.tournament_id)
    .single();

  if (tError || !tournament) throw new Error('Tournament not found');

  // Optionally clear manual overrides before syncing
  if (clearOverrides) {
    await supabase
      .from('tournament_results')
      .update({ manual_override: false })
      .eq('tournament_id', tournament.id)
      .eq('manual_override', true);
  }

  // Run sync
  const { syncTournamentResults } = await import('./scoringService');
  await syncTournamentResults(tournament.id, tournament.sportsdata_id);
}

// ============================================================================
// 5. Reset finalization (reverse finalizeCompetition)
// ============================================================================

export async function adminResetFinalization(
  adminId: string,
  competitionId: string
): Promise<void> {
  await requireAdmin(adminId);

  // 1. Check if finalization exists
  const { data: existingScores } = await supabase
    .from('competition_scores')
    .select('user_id, final_position')
    .eq('competition_id', competitionId);

  if (!existingScores || existingScores.length === 0) {
    // Nothing to reset
    return;
  }

  // 2. Get competition year for annual_leaderboard
  const { data: competition } = await supabase
    .from('competitions')
    .select('tournament_id')
    .eq('id', competitionId)
    .single();

  if (!competition) throw new Error('Competition not found');

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('end_date')
    .eq('id', competition.tournament_id)
    .single();

  if (!tournament) throw new Error('Tournament not found');

  const year = new Date(tournament.end_date).getFullYear();

  // 3. Fetch payments to compute net amounts to reverse
  const { data: payments } = await supabase
    .from('competition_payments')
    .select('from_user_id, to_user_id, amount, payment_type')
    .eq('competition_id', competitionId);

  // Build net maps
  const netMainByUser = new Map<string, number>();
  const netBountyByUser = new Map<string, number>();

  for (const p of (payments ?? [])) {
    if (p.payment_type === 'main_competition') {
      netMainByUser.set(p.to_user_id, (netMainByUser.get(p.to_user_id) ?? 0) + p.amount);
      netMainByUser.set(p.from_user_id, (netMainByUser.get(p.from_user_id) ?? 0) - p.amount);
    } else if (p.payment_type === 'bounty') {
      netBountyByUser.set(p.to_user_id, (netBountyByUser.get(p.to_user_id) ?? 0) + p.amount);
      netBountyByUser.set(p.from_user_id, (netBountyByUser.get(p.from_user_id) ?? 0) - p.amount);
    }
  }

  // 4. Reverse annual_leaderboard for each user
  const userIds = existingScores.map((s) => s.user_id);

  const { data: annualRows } = await supabase
    .from('annual_leaderboard')
    .select('*')
    .eq('year', year)
    .in('user_id', userIds);

  for (const row of (annualRows ?? [])) {
    const score = existingScores.find((s) => s.user_id === row.user_id);
    const wonDecrement = score?.final_position === 1 ? 1 : 0;
    const netMainReverse = netMainByUser.get(row.user_id) ?? 0;
    const netBountyReverse = netBountyByUser.get(row.user_id) ?? 0;

    const newTotalCompetitions = (row.total_competitions ?? 0) - 1;

    if (newTotalCompetitions <= 0) {
      // Delete the row entirely
      await supabase
        .from('annual_leaderboard')
        .delete()
        .eq('id', row.id);
    } else {
      await supabase
        .from('annual_leaderboard')
        .update({
          total_competitions: newTotalCompetitions,
          competitions_won: Math.max(0, (row.competitions_won ?? 0) - wonDecrement),
          total_winnings: parseFloat(((row.total_winnings ?? 0) - netMainReverse).toFixed(2)),
          total_bounties: parseFloat(((row.total_bounties ?? 0) - netBountyReverse).toFixed(2)),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
    }
  }

  // 5. Delete competition data (order matters for FK constraints)
  await supabase.from('competition_bounties').delete().eq('competition_id', competitionId);
  await supabase.from('competition_payments').delete().eq('competition_id', competitionId);
  await supabase.from('competition_scores').delete().eq('competition_id', competitionId);
}

// ============================================================================
// 6. Reset draft (revert to not_started state)
// ============================================================================

export async function adminResetDraft(
  adminId: string,
  competitionId: string
): Promise<void> {
  await requireAdmin(adminId);

  // If finalization has happened, reset that first
  const { data: existingScores } = await supabase
    .from('competition_scores')
    .select('id')
    .eq('competition_id', competitionId)
    .limit(1);

  if (existingScores && existingScores.length > 0) {
    await adminResetFinalization(adminId, competitionId);
  }

  // Delete draft artifacts (order matters)
  await supabase.from('alternates').delete().eq('competition_id', competitionId);
  await supabase.from('draft_picks').delete().eq('competition_id', competitionId);
  await supabase.from('draft_order').delete().eq('competition_id', competitionId);

  // Reset competition status
  const { error } = await supabase
    .from('competitions')
    .update({
      draft_status: 'not_started',
      draft_started_at: null,
      draft_completed_at: null,
    })
    .eq('id', competitionId);

  if (error) throw new Error(`Failed to reset draft: ${error.message}`);
}

// ============================================================================
// 7. Remove a participant (pre-draft only)
// ============================================================================

export async function adminRemoveParticipant(
  adminId: string,
  competitionId: string,
  targetUserId: string
): Promise<void> {
  await requireAdmin(adminId);

  // Only allow removal before draft starts
  const { data: competition } = await supabase
    .from('competitions')
    .select('draft_status')
    .eq('id', competitionId)
    .single();

  if (!competition) throw new Error('Competition not found');
  if (competition.draft_status !== 'not_started') {
    throw new Error('Can only remove participants before the draft starts');
  }

  const { error } = await supabase
    .from('competition_participants')
    .delete()
    .eq('competition_id', competitionId)
    .eq('user_id', targetUserId);

  if (error) throw new Error(`Failed to remove participant: ${error.message}`);
}
