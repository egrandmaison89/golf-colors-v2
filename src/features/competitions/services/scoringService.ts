/**
 * Scoring Service
 *
 * Calculates competition scores from draft picks and tournament results.
 * Implements logic from SCORING_LOGIC.md.
 */

import { supabase } from '@/lib/supabase/client';
import { getDraftPicks } from './draftService';
import { getAlternates } from './draftService';
import type { SportsDataLeaderboardEntry } from '@/features/tournaments/types';

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
    missedCut: boolean;
    withdrew: boolean;
  }[];
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
 */
export async function syncTournamentResults(
  tournamentId: string,
  sportsdataId: string
): Promise<void> {
  try {
    const { getTournamentLeaderboard } = await import('@/lib/api/sportsdata');
    const apiData = await getTournamentLeaderboard(sportsdataId);
    const entries = apiData as SportsDataLeaderboardEntry[];

    if (!Array.isArray(entries) || entries.length === 0) return;

    // Map sportsdata PlayerIDs to our internal golfer UUIDs
    const playerIds = entries.map((e) => String(e.PlayerID));
    const { data: golfers } = await supabase
      .from('golfers')
      .select('id, sportsdata_id')
      .in('sportsdata_id', playerIds);

    if (!golfers || golfers.length === 0) return;

    const golferMap = new Map(golfers.map((g) => [g.sportsdata_id, g.id]));

    const rows = entries
      .filter((e) => golferMap.has(String(e.PlayerID)))
      .map((e) => {
        const rounds = Array.isArray(e.Rounds)
          ? e.Rounds.map((r) => ({ Round: r.Round, Score: r.Score, ToPar: r.ToPar ?? 0 }))
          : null;

        return {
          tournament_id: tournamentId,
          golfer_id: golferMap.get(String(e.PlayerID))!,
          position: e.Position ?? null,
          total_score: e.TotalStrokes ?? null,
          total_to_par: e.TotalScore ?? null, // SportsData uses TotalScore for to-par value
          rounds,
          earnings: e.Earnings ?? null,
          made_cut: e.MadeCut ?? null,
          withdrew: e.Withdrew ?? false,
        };
      });

    if (rows.length === 0) return;

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

    for (const pick of sortedPicks) {
      const result = resultsByGolfer.get(pick.golfer_id);
      let scoreToPar: number | null = null;
      let usedAlternate = false;
      let missedCut = false;
      let withdrew = false;

      if (result) {
        if (result.withdrew) {
          withdrew = true;
          const altGolferId = alternateByUser.get(userId);
          if (altGolferId) {
            const altResult = resultsByGolfer.get(altGolferId);
            if (altResult) {
              scoreToPar = getEffectiveScoreToPar(altResult);
              usedAlternate = true;
            }
          }
          if (scoreToPar === null) {
            scoreToPar = maxDraftedScore + 1;
          }
        } else if (result.made_cut === false) {
          missedCut = true;
          scoreToPar = getMissedCutScore(result);
        } else {
          scoreToPar = result.total_to_par ?? 0;
        }
      }

      if (scoreToPar !== null) {
        teamScoreToPar += scoreToPar;
      }
      breakdown.push({
        golferId: pick.golfer_id,
        golferName: pick.golfer?.display_name ?? 'Unknown',
        scoreToPar,
        usedAlternate,
        missedCut,
        withdrew,
      });

      const strokes = result?.total_score;
      if (strokes != null) teamScoreStrokes += strokes;
    }

    entries.push({
      userId,
      displayName: displayNameByUser.get(userId) ?? 'Player',
      teamColor: teamColorByUser.get(userId) ?? null,
      teamScoreToPar,
      teamScoreStrokes,
      finalPosition: 0,
      scoreBreakdown: breakdown,
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

function getEffectiveScoreToPar(result: TournamentResult): number {
  if (result.withdrew) return 0;
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
