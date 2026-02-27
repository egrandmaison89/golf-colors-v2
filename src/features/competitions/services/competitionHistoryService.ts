/**
 * Competition History Service
 *
 * Fetches per-competition history for the dashboard.
 * Data comes from competition_scores (finalized after tournaments complete),
 * joined with competitions and tournaments for context.
 *
 * Used to populate:
 *   - Public competition history (Section 2 on Dashboard)
 *   - Private competition history (Section 3 on Dashboard)
 */

import { supabase } from '@/lib/supabase/client';

export interface CompetitionHistoryEntry {
  competition_id: string;
  competition_name: string;
  tournament_name: string;
  tournament_end_date: string;
  is_public: boolean;
  final_position: number;
  team_score_to_par: number;
  /** Net main competition winnings (positive = received, negative = paid) */
  net_winnings: number;
  /** Net bounty amount (positive = received, negative = paid) */
  net_bounties: number;
}

/**
 * Fetch competition history for a user.
 *
 * Uses client-side filtering to avoid invalid PostgREST nested-column syntax.
 *
 * @param userId  - The user whose history to fetch
 * @param isPublic - true for public competitions, false for private
 * @param limit  - Max rows to return (default 20)
 */
export async function getCompetitionHistory(
  userId: string,
  isPublic: boolean,
  limit = 20
): Promise<CompetitionHistoryEntry[]> {
  // Pull finalized scores for this user, joined with competitions + tournaments.
  // We do NOT use nested .eq() or nested .order() — those cause PostgREST parse errors.
  // Instead we filter and sort on the client after fetching.
  const { data: scores, error: scoresError } = await supabase
    .from('competition_scores')
    .select(`
      competition_id,
      final_position,
      team_score_to_par,
      competitions!inner (
        name,
        is_public,
        tournaments!inner (
          name,
          end_date,
          status
        )
      )
    `)
    .eq('user_id', userId);

  if (scoresError) {
    throw new Error(`Failed to fetch competition history: ${scoresError.message}`);
  }

  if (!scores || scores.length === 0) return [];

  // Filter client-side: matching is_public AND tournament status === 'completed'
  const filtered = (scores as any[])
    .filter((s) => {
      const comp = Array.isArray(s.competitions) ? s.competitions[0] : s.competitions;
      const tourn = Array.isArray(comp?.tournaments) ? comp.tournaments[0] : comp?.tournaments;
      return comp?.is_public === isPublic && tourn?.status === 'completed';
    })
    .sort((a, b) => {
      const compA = Array.isArray(a.competitions) ? a.competitions[0] : a.competitions;
      const compB = Array.isArray(b.competitions) ? b.competitions[0] : b.competitions;
      const tournA = Array.isArray(compA?.tournaments) ? compA.tournaments[0] : compA?.tournaments;
      const tournB = Array.isArray(compB?.tournaments) ? compB.tournaments[0] : compB?.tournaments;
      return (
        new Date(tournB?.end_date ?? '').getTime() -
        new Date(tournA?.end_date ?? '').getTime()
      );
    })
    .slice(0, limit);

  if (filtered.length === 0) return [];

  const competitionIds = filtered.map((s) => s.competition_id);

  // Fetch net payments for these competitions for this user
  const { data: payments } = await supabase
    .from('competition_payments')
    .select('competition_id, from_user_id, to_user_id, amount, payment_type')
    .in('competition_id', competitionIds)
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`);

  // Build net maps per competition
  const netMainByComp = new Map<string, number>();
  const netBountyByComp = new Map<string, number>();

  for (const payment of payments ?? []) {
    const compId = payment.competition_id;
    const isReceiver = payment.to_user_id === userId;
    const netChange = isReceiver ? Number(payment.amount) : -Number(payment.amount);

    if (payment.payment_type === 'main_competition') {
      netMainByComp.set(compId, (netMainByComp.get(compId) ?? 0) + netChange);
    } else if (payment.payment_type === 'bounty') {
      netBountyByComp.set(compId, (netBountyByComp.get(compId) ?? 0) + netChange);
    }
  }

  // Assemble results
  return filtered.map((score: any) => {
    const competition = Array.isArray(score.competitions)
      ? score.competitions[0]
      : score.competitions;
    const tournament = Array.isArray(competition?.tournaments)
      ? competition.tournaments[0]
      : competition?.tournaments;

    return {
      competition_id: score.competition_id,
      competition_name: competition?.name ?? 'Unknown',
      tournament_name: tournament?.name ?? 'Unknown',
      tournament_end_date: tournament?.end_date ?? '',
      is_public: competition?.is_public ?? isPublic,
      final_position: score.final_position ?? 0,
      team_score_to_par: score.team_score_to_par ?? 0,
      net_winnings: parseFloat((netMainByComp.get(score.competition_id) ?? 0).toFixed(2)),
      net_bounties: parseFloat((netBountyByComp.get(score.competition_id) ?? 0).toFixed(2)),
    };
  });
}
