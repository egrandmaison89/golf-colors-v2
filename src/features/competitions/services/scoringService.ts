/**
 * Scoring Service
 *
 * Calculates competition scores from draft picks and tournament results.
 * Implements logic from SCORING_LOGIC.md.
 */

import { supabase } from '@/lib/supabase/client';
import { getDraftPicks } from './draftService';
import { getAlternates } from './draftService';
// SportsDataLeaderboardEntry type no longer used — we now use PlayerTournamentRoundScores endpoint

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  teamColor: string | null;
  teamScoreToPar: number;
  teamScoreStrokes: number;
  finalPosition: number;
  scoreBreakdown: {
    golferId: string;
    golferName: string;
    scoreToPar: number | null;
    usedAlternate: boolean;
    alternateGolferName: string | null;
    missedCut: boolean;
    withdrew: boolean;
  }[];
  /** The team's selected alternate golfer (always shown, even if not activated) */
  alternate: {
    golferId: string;
    golferName: string;
    scoreToPar: number | null;
  } | null;
}

interface TournamentResult {
  golfer_id: string;
  total_to_par: number | null;
  total_score: number | null;
  made_cut: boolean | null;
  withdrew: boolean | null;
  rounds: { ToPar?: number }[] | null;
}

/**
 * Sync tournament results from SportsData.io into our tournament_results table.
 * Call this before getCompetitionLeaderboard when tournament is active or completed.
 *
 * Uses TWO API endpoints:
 * - /PlayerTournamentRoundScores/{id}: REAL scoring data (TotalScore, TotalStrokes, per-round)
 * - /Leaderboard/{id}: Tournament.Rounds[].IsRoundOver for cut detection
 *
 * The /Leaderboard endpoint returns DFS-scrambled scores — we only use it for structural
 * metadata (IsRoundOver). All scoring comes from /PlayerTournamentRoundScores.
 */
export async function syncTournamentResults(
  tournamentId: string,
  sportsdataId: string
): Promise<void> {
  try {
    const { getPlayerRoundScores, getTournamentLeaderboard } = await import('@/lib/api/sportsdata');

    // Fetch both endpoints in parallel
    const [roundScoresRaw, leaderboardRaw] = await Promise.all([
      getPlayerRoundScores(sportsdataId),
      getTournamentLeaderboard(sportsdataId),
    ]);

    const players: any[] = Array.isArray(roundScoresRaw) ? roundScoresRaw : [];
    if (players.length === 0) return;

    // Determine current round from Leaderboard's Tournament.Rounds[].IsRoundOver
    const tournamentRounds: any[] = (leaderboardRaw as any)?.Tournament?.Rounds ?? [];
    let currentRound = 1;
    for (const r of tournamentRounds) {
      if (r.IsRoundOver === true) {
        currentRound = Math.max(currentRound, (r.Number ?? 0) + 1);
      }
    }
    currentRound = Math.min(currentRound, 4);
    const cutHasBeenMade = currentRound >= 3;

    // Map sportsdata PlayerIDs to our internal golfer UUIDs
    const playerIds = players.map((p: any) => String(p.PlayerID));
    const { data: golfers } = await supabase
      .from('golfers')
      .select('id, sportsdata_id')
      .in('sportsdata_id', playerIds);

    if (!golfers || golfers.length === 0) return;

    const golferMap = new Map(golfers.map((g) => [g.sportsdata_id, g.id]));

    const rows: any[] = players
      .filter((p: any) => golferMap.has(String(p.PlayerID)))
      .map((p: any) => {
        // TotalScore from PlayerTournamentRoundScores is the REAL to-par value.
        // TotalStrokes is the REAL total strokes.
        const totalToPar = p.TotalScore != null ? Math.round(p.TotalScore) : null;
        const totalStrokes = p.TotalStrokes != null ? Math.round(p.TotalStrokes) : null;

        // Build rounds summary from PlayerRoundScore[].
        // Each round with Par > 0 has real data: ToPar = Score - Par.
        const roundsSummary: { Round: number; ToPar: number }[] = [];
        for (const r of (p.PlayerRoundScore ?? []) as any[]) {
          if (r.Par > 0 && r.Score > 0) {
            roundsSummary.push({ Round: r.Number, ToPar: r.Score - r.Par });
          }
        }

        // Withdrawn: TotalScore is null (player never started or withdrew pre-tournament)
        const withdrew = totalToPar === null;

        // Made cut: only determinable after round 3+ begins.
        // A player who made the cut will have round 3+ data with Par > 0.
        const hasRound3Plus = (p.PlayerRoundScore ?? []).some(
          (r: any) => r.Number >= 3 && r.Par > 0
        );
        const madeCut: boolean | null =
          withdrew ? null :
          cutHasBeenMade ? hasRound3Plus : null;

        return {
          tournament_id: tournamentId,
          golfer_id: golferMap.get(String(p.PlayerID))!,
          position: null as number | null, // assigned below after sorting
          total_score: totalStrokes,
          total_to_par: totalToPar,
          rounds: roundsSummary.length > 0 ? roundsSummary : null,
          earnings: null,
          made_cut: madeCut,
          withdrew,
        };
      });

    if (rows.length === 0) return;

    // Assign positions by sorting non-withdrawn players by total_to_par ascending.
    // Ties get the same position (e.g. T1, T1, 3, 4...).
    const active = rows
      .filter((r) => r.total_to_par !== null)
      .sort((a, b) => a.total_to_par! - b.total_to_par!);
    let pos = 1;
    for (let i = 0; i < active.length; i++) {
      if (i > 0 && active[i].total_to_par !== active[i - 1].total_to_par) {
        pos = i + 1;
      }
      active[i].position = pos;
    }

    await supabase
      .from('tournament_results')
      .upsert(rows, { onConflict: 'tournament_id,golfer_id' });
  } catch (err) {
    console.error('syncTournamentResults failed:', err);
  }
}

/**
 * Get leaderboard for a competition (calculated from picks and tournament results)
 */
export async function getCompetitionLeaderboard(
  competitionId: string
): Promise<LeaderboardEntry[]> {
  const competition = await getCompetitionWithTournament(competitionId);
  if (!competition) return [];

  const tournamentId = competition.tournament_id;

  const [picks, results, alternatesData, userProfiles] = await Promise.all([
    getDraftPicks(competitionId),
    getTournamentResults(tournamentId),
    getAlternates(competitionId),
    getParticipantProfiles(competitionId),
  ]);

  if (results.length === 0) return [];

  const resultsByGolfer = new Map<string, TournamentResult>();
  results.forEach((r) => resultsByGolfer.set(r.golfer_id, r));

  const alternateByUser = new Map<string, string>();
  alternatesData.forEach((a) => alternateByUser.set(a.user_id, a.golfer_id));

  // Build map of userId → alternate golfer display name (for UI labels)
  const alternateGolferNameByUser = new Map<string, string>();
  alternatesData.forEach((a: any) => {
    const golfer = Array.isArray(a.golfers) ? a.golfers[0] : a.golfers;
    alternateGolferNameByUser.set(a.user_id, golfer?.display_name ?? 'Unknown');
  });

  const picksByUser = new Map<string, typeof picks>();
  picks.forEach((p) => {
    const list = picksByUser.get(p.user_id) || [];
    list.push(p);
    picksByUser.set(p.user_id, list);
  });

  // userId -> displayName
  const displayNameByUser = new Map<string, string>(
    userProfiles.map((p) => [p.id, p.display_name ?? 'Player'])
  );

  // userId -> teamColor
  const teamColorByUser = new Map<string, string | null>(
    userProfiles.map((p) => [p.id, p.team_color ?? null])
  );

  const draftedGolferIds = new Set(picks.map((p) => p.golfer_id));
  const maxDraftedScore = getMaxDraftedScore(results, draftedGolferIds);

  const entries: LeaderboardEntry[] = [];

  for (const [userId, userPicks] of picksByUser) {
    const sortedPicks = [...userPicks].sort((a, b) => a.pick_number - b.pick_number);
    if (sortedPicks.length < 3) continue;

    const breakdown: LeaderboardEntry['scoreBreakdown'] = [];
    let teamScoreToPar = 0;
    let teamScoreStrokes = 0;
    let alternateUsed = false; // Track per-user: each user's alternate can only be used once

    for (const pick of sortedPicks) {
      const result = resultsByGolfer.get(pick.golfer_id);
      let scoreToPar: number | null = null;
      let usedAlternate = false;
      let missedCut = false;
      let withdrew = false;

      // Determine if this player is effectively "not playing":
      //   - No tournament_results row at all (not in API Players array)
      //   - Result exists but total_to_par is null AND not already flagged as
      //     withdrew or missed-cut (player in API but never started playing)
      const isEffectivelyWithdrawn =
        !result ||
        (result.total_to_par === null && !result.withdrew && result.made_cut !== false);

      if (isEffectivelyWithdrawn || result?.withdrew) {
        // Player withdrew or never started — apply alternate/penalty logic
        withdrew = true;
        const resolved = resolveWithdrawalScore(
          userId, alternateByUser, resultsByGolfer, alternateUsed, maxDraftedScore
        );
        scoreToPar = resolved.scoreToPar;
        usedAlternate = resolved.usedAlternate;
        alternateUsed = resolved.alternateUsed;
      } else if (result!.made_cut === false) {
        missedCut = true;
        scoreToPar = getMissedCutScore(result!);
      } else {
        scoreToPar = result!.total_to_par ?? 0;
      }

      if (scoreToPar !== null) {
        teamScoreToPar += scoreToPar;
      }
      breakdown.push({
        golferId: pick.golfer_id,
        golferName: pick.golfer?.display_name ?? 'Unknown',
        scoreToPar,
        usedAlternate,
        alternateGolferName: usedAlternate
          ? (alternateGolferNameByUser.get(userId) ?? null)
          : null,
        missedCut,
        withdrew,
      });

      const strokes = result?.total_score;
      if (strokes != null) teamScoreStrokes += strokes;
    }

    // Build alternate info for display (always shown, even if not activated)
    const altGolferId = alternateByUser.get(userId);
    let alternate: LeaderboardEntry['alternate'] = null;
    if (altGolferId) {
      const altResult = resultsByGolfer.get(altGolferId);
      alternate = {
        golferId: altGolferId,
        golferName: alternateGolferNameByUser.get(userId) ?? 'Unknown',
        scoreToPar: altResult?.total_to_par ?? null,
      };
    }

    entries.push({
      userId,
      displayName: displayNameByUser.get(userId) ?? 'Player',
      teamColor: teamColorByUser.get(userId) ?? null,
      teamScoreToPar,
      teamScoreStrokes,
      finalPosition: 0,
      scoreBreakdown: breakdown,
      alternate,
    });
  }

  entries.sort((a, b) => a.teamScoreToPar - b.teamScoreToPar);

  let position = 1;
  for (const entry of entries) {
    entry.finalPosition = position++;
  }

  return entries;
}

/**
 * Get cached competition scores from database (pre-calculated)
 */
export async function getCompetitionScores(competitionId: string) {
  const { data, error } = await supabase
    .from('competition_scores')
    .select('*')
    .eq('competition_id', competitionId)
    .order('final_position', { ascending: true });

  if (error) throw new Error(`Failed to fetch scores: ${error.message}`);
  return data || [];
}

async function getCompetitionWithTournament(competitionId: string) {
  const { data, error } = await supabase
    .from('competitions')
    .select('id, tournament_id')
    .eq('id', competitionId)
    .single();

  if (error) return null;
  return data;
}

/**
 * Fetch display names and team colors for all participants in a competition via user_profiles.
 */
async function getParticipantProfiles(
  competitionId: string
): Promise<{ id: string; display_name: string | null; team_color: string | null }[]> {
  // Get participant user_ids
  const { data: participants, error: partError } = await supabase
    .from('competition_participants')
    .select('user_id')
    .eq('competition_id', competitionId);

  if (partError || !participants || participants.length === 0) return [];

  const userIds = participants.map((p) => p.user_id);

  const { data: profiles, error: profError } = await supabase
    .from('user_profiles')
    .select('id, display_name, team_color')
    .in('id', userIds);

  if (profError || !profiles) return [];

  return profiles;
}

async function getTournamentResults(tournamentId: string): Promise<TournamentResult[]> {
  const { data, error } = await supabase
    .from('tournament_results')
    .select('golfer_id, total_to_par, total_score, made_cut, withdrew, rounds')
    .eq('tournament_id', tournamentId);

  if (error) return [];
  return (data as TournamentResult[]) || [];
}

/**
 * Resolve the score for a withdrawn/non-playing drafted player.
 * Tries to use the user's alternate (if available and not already consumed).
 * Falls back to maxDraftedScore + 1 penalty if no alternate is available.
 */
function resolveWithdrawalScore(
  userId: string,
  alternateByUser: Map<string, string>,
  resultsByGolfer: Map<string, TournamentResult>,
  alternateUsed: boolean,
  maxDraftedScore: number,
): { scoreToPar: number; usedAlternate: boolean; alternateUsed: boolean } {
  if (!alternateUsed) {
    const altGolferId = alternateByUser.get(userId);
    if (altGolferId) {
      const altResult = resultsByGolfer.get(altGolferId);
      // Only use the alternate if they are actually playing (not withdrawn, have a score)
      if (altResult && !altResult.withdrew && altResult.total_to_par !== null) {
        return {
          scoreToPar: getEffectiveScoreToPar(altResult),
          usedAlternate: true,
          alternateUsed: true,
        };
      }
    }
  }
  return {
    scoreToPar: maxDraftedScore + 1,
    usedAlternate: false,
    alternateUsed,
  };
}

function getEffectiveScoreToPar(result: TournamentResult): number {
  // Note: caller should check result.withdrew and result.total_to_par before calling.
  // This function is for players who ARE playing (not withdrawn, have data).
  if (result.made_cut === false) return getMissedCutScore(result);
  return result.total_to_par ?? 0;
}

function getMissedCutScore(result: TournamentResult): number {
  const rounds = result.rounds as { ToPar?: number }[] | null;
  if (rounds && rounds.length >= 2) {
    const twoRoundToPar = (rounds[0]?.ToPar ?? 0) + (rounds[1]?.ToPar ?? 0);
    return twoRoundToPar * 2;
  }
  return (result.total_to_par ?? 0) * 2;
}

function getMaxDraftedScore(
  results: TournamentResult[],
  draftedGolferIds: Set<string>
): number {
  let max = 0;
  for (const r of results) {
    if (!draftedGolferIds.has(r.golfer_id)) continue;
    const score = r.withdrew ? 0 : r.made_cut === false ? getMissedCutScore(r) : (r.total_to_par ?? 0);
    if (score > max) max = score;
  }
  return max;
}

// ============================================================================
// FINALIZATION — persists final results when a tournament completes
// ============================================================================

/**
 * Finalize a completed competition:
 *   1. Idempotency guard — skips if competition_scores already exist
 *   2. Calculate leaderboard
 *   3. Calculate & persist bounties (via bountyService)
 *   4. Persist main competition payments ($1/stroke differential)
 *   5. Persist competition_scores (one row per user)
 *   6. Upsert annual_leaderboard (net winnings + bounties for the year)
 *
 * Safe to call on every page load — the guard prevents double-counting.
 */
export async function finalizeCompetition(competitionId: string): Promise<void> {
  try {
    // 1. Idempotency guard
    const { data: existingScores } = await supabase
      .from('competition_scores')
      .select('id')
      .eq('competition_id', competitionId)
      .limit(1);

    if (existingScores && existingScores.length > 0) {
      return; // Already finalized
    }

    // 2. Get leaderboard
    const leaderboard = await getCompetitionLeaderboard(competitionId);
    if (leaderboard.length === 0) return;

    // 3. Calculate & persist bounties
    const { calculateBounties } = await import('./bountyService');
    const bountyResult = await calculateBounties(competitionId, leaderboard);

    // 4. Calculate main competition payments ($1/stroke per loser)
    const winners = leaderboard.filter((e) => e.finalPosition === 1);
    const losers = leaderboard.filter((e) => e.finalPosition > 1);

    // Net payments: map userId -> net amount (positive = received, negative = paid)
    const netMainByUser = new Map<string, number>();
    leaderboard.forEach((e) => netMainByUser.set(e.userId, 0));

    if (winners.length > 0 && losers.length > 0) {
      const winnerScore = winners[0].teamScoreToPar;

      for (const loser of losers) {
        const strokeDiff = loser.teamScoreToPar - winnerScore;
        if (strokeDiff <= 0) continue;

        // Each loser pays (strokeDiff / winnerCount) to each winner
        const amountPerWinner = strokeDiff / winners.length;

        for (const winner of winners) {
          // Persist payment row
          await supabase.from('competition_payments').upsert(
            {
              competition_id: competitionId,
              from_user_id: loser.userId,
              to_user_id: winner.userId,
              amount: parseFloat(amountPerWinner.toFixed(2)),
              payment_type: 'main_competition',
            },
            { onConflict: 'competition_id,from_user_id,to_user_id,payment_type' }
          );

          // Track net
          netMainByUser.set(winner.userId, (netMainByUser.get(winner.userId) ?? 0) + amountPerWinner);
          netMainByUser.set(loser.userId, (netMainByUser.get(loser.userId) ?? 0) - strokeDiff);
        }
      }
    }

    // 5. Persist competition_scores
    const scoreRows = leaderboard.map((entry) => ({
      competition_id: competitionId,
      user_id: entry.userId,
      team_score_strokes: entry.teamScoreStrokes,
      team_score_to_par: entry.teamScoreToPar,
      final_position: entry.finalPosition,
      score_breakdown: entry.scoreBreakdown,
      calculated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    await supabase
      .from('competition_scores')
      .upsert(scoreRows, { onConflict: 'competition_id,user_id' });

    // 6. Upsert annual_leaderboard
    // Get tournament end_date to determine the year
    const { data: competition } = await supabase
      .from('competitions')
      .select('tournament_id')
      .eq('id', competitionId)
      .single();

    if (!competition) return;

    const { data: tournament } = await supabase
      .from('tournaments')
      .select('end_date')
      .eq('id', competition.tournament_id)
      .single();

    if (!tournament) return;

    const year = new Date(tournament.end_date).getFullYear();

    // Build bounty nets per user from bountyResult payments
    const netBountyByUser = new Map<string, number>();
    leaderboard.forEach((e) => netBountyByUser.set(e.userId, 0));

    if (bountyResult) {
      // Winner receives
      netBountyByUser.set(
        bountyResult.winnerUserId,
        (netBountyByUser.get(bountyResult.winnerUserId) ?? 0) + bountyResult.totalBounty
      );
      // Each payer owes
      for (const payment of bountyResult.payments) {
        netBountyByUser.set(
          payment.fromUserId,
          (netBountyByUser.get(payment.fromUserId) ?? 0) - payment.amount
        );
      }
    }

    // Fetch existing annual_leaderboard rows for these users
    const userIds = leaderboard.map((e) => e.userId);
    const { data: existingRows } = await supabase
      .from('annual_leaderboard')
      .select('*')
      .eq('year', year)
      .in('user_id', userIds);

    const existingByUser = new Map(
      (existingRows ?? []).map((r) => [r.user_id, r])
    );

    const annualRows = leaderboard.map((entry) => {
      const existing = existingByUser.get(entry.userId);
      const netMain = netMainByUser.get(entry.userId) ?? 0;
      const netBounty = netBountyByUser.get(entry.userId) ?? 0;
      const won = entry.finalPosition === 1 ? 1 : 0;

      return {
        user_id: entry.userId,
        year,
        total_competitions: (existing?.total_competitions ?? 0) + 1,
        competitions_won: (existing?.competitions_won ?? 0) + won,
        total_winnings: parseFloat(((existing?.total_winnings ?? 0) + netMain).toFixed(2)),
        total_bounties: parseFloat(((existing?.total_bounties ?? 0) + netBounty).toFixed(2)),
        updated_at: new Date().toISOString(),
      };
    });

    await supabase
      .from('annual_leaderboard')
      .upsert(annualRows, { onConflict: 'user_id,year' });
  } catch (err) {
    // Finalization failure should not break the UI
    console.error('finalizeCompetition failed:', err);
  }
}
