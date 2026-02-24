/**
 * Bounty Service
 *
 * Calculates and stores bounties when a drafted golfer wins the tournament outright.
 *
 * Bounty rules:
 *   - Trigger: A drafted golfer finishes in position 1 (tournament winner)
 *   - Tier amounts based on pick round of winner:
 *       Round 1 pick wins → 1 tier  → $10 total
 *       Round 2 pick wins → 2 tiers → $20 total
 *       Round 3 pick wins → 3 tiers → $30 total
 *   - Who pays (bottom of final standings, one team per tier):
 *       Tier 1: last place pays $10
 *       Tier 2: 2nd-to-last pays $10  (if round 2 or 3)
 *       Tier 3: 3rd-to-last pays $10  (if round 3)
 *   - Who receives: the team that drafted the winner gets the full bounty
 */

import { supabase } from '@/lib/supabase/client';
import type { LeaderboardEntry } from './scoringService';

export interface BountyPayment {
  fromUserId: string;
  fromDisplayName: string;
  toUserId: string;
  toDisplayName: string;
  amount: number;
}

export interface BountyResult {
  golferName: string;
  winnerUserId: string;
  winnerDisplayName: string;
  pickRound: 1 | 2 | 3;
  totalBounty: number;
  payments: BountyPayment[];
}

/**
 * Calculate bounties for a completed competition.
 * Returns null if no drafted golfer won the tournament.
 */
export async function calculateBounties(
  competitionId: string,
  leaderboard: LeaderboardEntry[]
): Promise<BountyResult | null> {
  if (leaderboard.length === 0) return null;

  // Get draft picks with golfer + tournament result info
  const { data: picks, error: picksError } = await supabase
    .from('draft_picks')
    .select(`
      user_id,
      golfer_id,
      draft_round,
      golfers (display_name)
    `)
    .eq('competition_id', competitionId);

  if (picksError || !picks || picks.length === 0) return null;

  // Get competition's tournament to find winner
  const { data: competition, error: compError } = await supabase
    .from('competitions')
    .select('tournament_id')
    .eq('id', competitionId)
    .single();

  if (compError || !competition) return null;

  // Find golfers in position 1 for this tournament
  const { data: winnerResults, error: winnerError } = await supabase
    .from('tournament_results')
    .select('golfer_id, position')
    .eq('tournament_id', competition.tournament_id)
    .eq('position', 1);

  if (winnerError || !winnerResults || winnerResults.length === 0) return null;

  const winnerGolferIds = new Set(winnerResults.map((r) => r.golfer_id));

  // Find if any of those winners were drafted
  const winningPick = picks.find((p) => winnerGolferIds.has(p.golfer_id));
  if (!winningPick) return null; // Winner wasn't drafted → no bounty

  const pickRound = winningPick.draft_round as 1 | 2 | 3;
  const tierCount = pickRound; // 1 tier for round 1, 2 for round 2, 3 for round 3
  const totalBounty = tierCount * 10;

  const golferRaw = winningPick.golfers as { display_name: string } | { display_name: string }[] | null;
  const golferName = (Array.isArray(golferRaw) ? golferRaw[0]?.display_name : golferRaw?.display_name) ?? 'Unknown';

  const winnerUserId = winningPick.user_id;

  // Find the winner's displayName from leaderboard
  const winnerEntry = leaderboard.find((e) => e.userId === winnerUserId);
  const winnerDisplayName = winnerEntry?.displayName ?? 'Player';

  // Payers: bottom N teams from final standings (sorted worst → best = last → first)
  // leaderboard is already sorted best → worst (position 1 = first element)
  const sortedWorstFirst = [...leaderboard].sort((a, b) => b.finalPosition - a.finalPosition);

  const payments: BountyPayment[] = [];
  for (let tier = 0; tier < tierCount; tier++) {
    const payer = sortedWorstFirst[tier];
    if (!payer || payer.userId === winnerUserId) {
      // Edge case: winner is also the payer (e.g. only 1 participant) — skip
      continue;
    }
    payments.push({
      fromUserId: payer.userId,
      fromDisplayName: payer.displayName,
      toUserId: winnerUserId,
      toDisplayName: winnerDisplayName,
      amount: 10,
    });
  }

  // Upsert bounties + payments into DB
  await persistBounties(competitionId, winnerUserId, winningPick.golfer_id, pickRound, payments);

  return {
    golferName,
    winnerUserId,
    winnerDisplayName,
    pickRound,
    totalBounty,
    payments,
  };
}

async function persistBounties(
  competitionId: string,
  winnerUserId: string,
  golferWinnerId: string,
  pickRound: 1 | 2 | 3,
  payments: BountyPayment[]
): Promise<void> {
  try {
    // Upsert into competition_bounties (winner record)
    await supabase.from('competition_bounties').upsert(
      {
        competition_id: competitionId,
        user_id: winnerUserId,
        golfer_id: golferWinnerId,
        pick_round: pickRound,
        bounty_amount: payments.reduce((sum, p) => sum + p.amount, 0),
      },
      { onConflict: 'competition_id,user_id,golfer_id' }
    );

    // Upsert into competition_payments
    for (const payment of payments) {
      await supabase.from('competition_payments').upsert(
        {
          competition_id: competitionId,
          from_user_id: payment.fromUserId,
          to_user_id: payment.toUserId,
          amount: payment.amount,
          payment_type: 'bounty',
        },
        { onConflict: 'competition_id,from_user_id,to_user_id,payment_type' }
      );
    }
  } catch (err) {
    // Persistence failure shouldn't break the UI
    console.error('Failed to persist bounties:', err);
  }
}
