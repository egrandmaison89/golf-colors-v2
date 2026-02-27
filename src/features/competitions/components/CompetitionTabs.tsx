/**
 * CompetitionTabs component
 *
 * Replaces CompetitionLeaderboard with a tabbed view for completed drafts.
 *
 * Tabs:
 *   1. Teams    — each user's team (3 picks) with combined score (existing leaderboard)
 *   2. Full Field — all golfers in the tournament sorted by rank; drafted ones are color-marked
 *   3. Drafted  — only drafted golfers + alternates, sorted by score
 *   4. Results  — live payment preview (what each player would owe/win right now)
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useCompetitionLeaderboard } from '../hooks/useCompetitionLeaderboard';
import { BountyCard } from './BountyCard';
import type { LeaderboardEntry } from '../services/scoringService';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'teams' | 'field' | 'drafted' | 'results';

interface CompetitionTabsProps {
  competitionId: string;
  tournamentId: string;
  sportsdataId?: string | null;
  currentUserId: string | undefined;
  tournamentStatus?: string;
}

interface FieldEntry {
  golferId: string;
  golferName: string;
  rank: number | null;
  scoreToPar: number | null;
  madeCut: boolean | null;
  withdrew: boolean;
  // Draft overlay
  draftedByUserId: string | null;
  draftedByDisplayName: string | null;
  draftedByColor: string | null;
  draftRound: number | null;
  // Alternate overlay
  isAlternateFor: string | null;      // userId whose alternate this is
  alternateOwnerColor: string | null;
  alternateOwnerName: string | null;
  // Live data (from API during active tournaments)
  thru: string | null;
  today: number | null;
}

interface ResultEntry {
  userId: string;
  displayName: string;
  teamColor: string | null;
  position: number;
  teamScoreToPar: number;
  netAmount: number; // positive = receive, negative = owe
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type TeamColor = 'yellow' | 'red' | 'green' | 'blue';

const COLOR_DOT: Record<TeamColor, string> = {
  yellow: 'bg-yellow-400',
  red: 'bg-red-500',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
};

const COLOR_RING: Record<TeamColor, string> = {
  yellow: 'ring-yellow-400',
  red: 'ring-red-500',
  green: 'ring-green-500',
  blue: 'ring-blue-500',
};

function ColorDot({ color, size = 'sm' }: { color: string | null; size?: 'sm' | 'lg' }) {
  if (!color || !(color in COLOR_DOT)) return null;
  const dim = size === 'lg' ? 'w-3 h-3' : 'w-2.5 h-2.5';
  return (
    <span
      className={`${dim} rounded-full shrink-0 ${COLOR_DOT[color as TeamColor]}`}
      title={`${color} team`}
    />
  );
}

function formatScore(n: number | null): string {
  if (n === null) return '—';
  if (n === 0) return 'E';
  return n > 0 ? `+${n}` : `${n}`;
}

function scoreColor(n: number | null): string {
  if (n === null) return 'text-gray-400';
  if (n < 0) return 'text-red-600 font-bold';
  if (n > 0) return 'text-blue-600';
  return 'text-gray-700';
}

function ordinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

/** Calculate live payment amounts from current leaderboard. */
function calculateLivePayments(leaderboard: LeaderboardEntry[]): ResultEntry[] {
  const winners = leaderboard.filter((e) => e.finalPosition === 1);
  const losers = leaderboard.filter((e) => e.finalPosition > 1);

  const netByUser = new Map<string, number>();
  leaderboard.forEach((e) => netByUser.set(e.userId, 0));

  if (winners.length > 0 && losers.length > 0) {
    const winnerScore = winners[0].teamScoreToPar;
    for (const loser of losers) {
      const diff = loser.teamScoreToPar - winnerScore;
      if (diff <= 0) continue;
      const perWinner = diff / winners.length;
      for (const winner of winners) {
        netByUser.set(winner.userId, (netByUser.get(winner.userId) ?? 0) + perWinner);
        netByUser.set(loser.userId, (netByUser.get(loser.userId) ?? 0) - diff);
      }
    }
  }

  return leaderboard.map((entry) => ({
    userId: entry.userId,
    displayName: entry.displayName,
    teamColor: entry.teamColor,
    position: entry.finalPosition,
    teamScoreToPar: entry.teamScoreToPar,
    netAmount: parseFloat((netByUser.get(entry.userId) ?? 0).toFixed(2)),
  }));
}

// ─── Sub-views ────────────────────────────────────────────────────────────────

/** Teams tab — existing leaderboard view with per-golfer breakdown */
function TeamsView({
  leaderboard,
  currentUserId,
  tournamentStatus,
  competitionId,
}: {
  leaderboard: LeaderboardEntry[];
  currentUserId: string | undefined;
  tournamentStatus?: string;
  competitionId: string;
}) {
  if (leaderboard.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-gray-500">
          Scores will appear here once the tournament is underway.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {leaderboard.map((entry) => {
        const isMe = entry.userId === currentUserId;
        const name = isMe ? 'You' : entry.displayName;

        return (
          <div
            key={entry.userId}
            className={`rounded-xl border p-4 ${
              isMe ? 'border-indigo-200 bg-indigo-50' : 'border-gray-100 bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <span className="w-8 text-center font-bold text-gray-500 text-sm">
                  {ordinal(entry.finalPosition)}
                </span>
                <ColorDot color={entry.teamColor} />
                <span className={`font-semibold ${isMe ? 'text-indigo-700' : 'text-gray-900'}`}>
                  {name}
                </span>
              </div>
              <div className="text-right">
                <span className={`font-mono font-bold text-lg ${scoreColor(entry.teamScoreToPar)}`}>
                  {formatScore(entry.teamScoreToPar)}
                </span>
                <span className="text-xs text-gray-400 ml-1">to par</span>
              </div>
            </div>

            <div className="ml-10 space-y-1">
              {entry.scoreBreakdown.map((g) => (
                <div key={g.golferId} className="flex justify-between text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    {g.withdrew && g.usedAlternate ? (
                      <>
                        <span className="line-through text-gray-400">{g.golferName}</span>
                        <span className="text-xs text-amber-600 font-medium">
                          → {g.alternateGolferName ?? 'Alt'} (alt)
                        </span>
                      </>
                    ) : (
                      g.golferName
                    )}
                    {g.missedCut && <span className="text-xs text-red-500">(MC)</span>}
                    {g.withdrew && !g.usedAlternate && (
                      <span className="text-xs text-gray-400">(WD)</span>
                    )}
                  </span>
                  <span className={`font-mono ${scoreColor(g.scoreToPar)}`}>
                    {formatScore(g.scoreToPar)}
                  </span>
                </div>
              ))}
              {/* Alternate golfer — always shown if selected, muted to indicate it doesn't count unless a WD occurs */}
              {entry.alternate && (
                <div className="flex justify-between text-sm text-gray-400 mt-1 pt-1 border-t border-dashed border-gray-200">
                  <span className="flex items-center gap-1.5 italic">
                    <span className="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded font-medium not-italic">
                      ALT
                    </span>
                    {entry.alternate.golferName}
                  </span>
                  <span className="font-mono text-gray-300">
                    {formatScore(entry.alternate.scoreToPar)}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {tournamentStatus === 'completed' && (
        <BountyCard competitionId={competitionId} leaderboard={leaderboard} />
      )}
    </div>
  );
}

/** Shared table for Full Field and Drafted tabs */
function FieldTable({
  entries,
  currentUserId,
  emptyMessage,
}: {
  entries: FieldEntry[];
  currentUserId: string | undefined;
  emptyMessage: string;
}) {
  if (entries.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="pl-4 pr-2 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide w-10">
              Pos
            </th>
            <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Golfer
            </th>
            <th className="px-2 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Score
            </th>
            <th className="px-2 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">
              Today
            </th>
            <th className="px-2 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">
              Thru
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Team
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {entries.map((entry, i) => {
            const isDraftedByMe = entry.draftedByUserId === currentUserId;
            const isMyAlternate = entry.isAlternateFor === currentUserId;

            return (
              <tr
                key={`${entry.golferId}-${i}`}
                className={`${isDraftedByMe || isMyAlternate ? 'bg-green-50' : 'hover:bg-gray-50'} transition-colors`}
              >
                {/* Position */}
                <td className="pl-4 pr-2 py-2.5 text-gray-500 font-medium text-xs">
                  {entry.withdrew
                    ? 'WD'
                    : entry.madeCut === false
                    ? 'MC'
                    : entry.rank ?? '—'}
                </td>

                {/* Golfer name + status badges */}
                <td className="px-2 py-2.5 font-medium text-gray-900">
                  <div className="flex items-center gap-1.5">
                    <span>{entry.golferName}</span>
                    {entry.withdrew && (
                      <span className="text-xs text-gray-400 font-normal">(WD)</span>
                    )}
                    {entry.madeCut === false && !entry.withdrew && (
                      <span className="text-xs text-red-500 font-normal">(MC)</span>
                    )}
                    {entry.isAlternateFor && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">
                        ALT
                      </span>
                    )}
                  </div>
                </td>

                {/* Score */}
                <td className={`px-2 py-2.5 text-right font-mono font-semibold ${scoreColor(entry.scoreToPar)}`}>
                  {formatScore(entry.scoreToPar)}
                </td>

                {/* Today */}
                <td className={`px-2 py-2.5 text-right font-mono text-sm hidden sm:table-cell ${scoreColor(entry.today)}`}>
                  {entry.today !== null ? formatScore(entry.today) : '—'}
                </td>

                {/* Thru */}
                <td className="px-2 py-2.5 text-right text-gray-400 text-xs hidden sm:table-cell">
                  {entry.thru ?? '—'}
                </td>

                {/* Team indicator */}
                <td className="px-4 py-2.5 text-right">
                  {entry.draftedByColor ? (
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-xs text-gray-500">{entry.draftedByDisplayName}</span>
                      <span
                        className={`w-3 h-3 rounded-full ${COLOR_DOT[entry.draftedByColor as TeamColor] ?? 'bg-gray-300'}`}
                      />
                    </div>
                  ) : entry.alternateOwnerColor ? (
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-xs text-gray-400">{entry.alternateOwnerName}</span>
                      <span
                        className={`w-3 h-3 rounded-full ring-2 ring-offset-1 ${COLOR_RING[entry.alternateOwnerColor as TeamColor] ?? 'ring-gray-300'} ${COLOR_DOT[entry.alternateOwnerColor as TeamColor] ?? 'bg-gray-300'} opacity-60`}
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Results tab — live payment preview */
function ResultsView({
  leaderboard,
  currentUserId,
}: {
  leaderboard: LeaderboardEntry[];
  currentUserId: string | undefined;
}) {
  if (leaderboard.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-gray-500">
          Scores needed to calculate payments.
        </p>
      </div>
    );
  }

  const results = calculateLivePayments(leaderboard);

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400 italic">
        Live preview — based on current standings. Finalizes when tournament completes.
      </p>
      <div className="overflow-hidden rounded-xl border border-gray-100">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="pl-4 pr-2 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Player
              </th>
              <th className="px-2 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Score
              </th>
              <th className="pr-4 pl-2 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Net
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {results.map((r) => {
              const isMe = r.userId === currentUserId;
              const positive = r.netAmount >= 0;
              return (
                <tr
                  key={r.userId}
                  className={isMe ? 'bg-green-50' : 'hover:bg-gray-50 transition-colors'}
                >
                  <td className="pl-4 pr-2 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 w-6">
                        {ordinal(r.position)}
                      </span>
                      <ColorDot color={r.teamColor} />
                      <span className={`font-medium ${isMe ? 'text-green-700' : 'text-gray-900'}`}>
                        {isMe ? 'You' : r.displayName}
                      </span>
                    </div>
                  </td>
                  <td className={`px-2 py-3 text-right font-mono font-semibold ${scoreColor(r.teamScoreToPar)}`}>
                    {formatScore(r.teamScoreToPar)}
                  </td>
                  <td className="pr-4 pl-2 py-3 text-right">
                    <span className={`font-semibold ${positive ? 'text-green-600' : 'text-red-500'}`}>
                      {positive ? '+' : '-'}${Math.abs(r.netAmount).toFixed(2)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CompetitionTabs({
  competitionId,
  tournamentId,
  sportsdataId,
  currentUserId,
  tournamentStatus,
}: CompetitionTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('teams');
  const { leaderboard, loading: lbLoading, error: lbError } = useCompetitionLeaderboard(competitionId);

  // Field data — used by Full Field and Drafted tabs
  const [fieldEntries, setFieldEntries] = useState<FieldEntry[]>([]);
  const [fieldLoading, setFieldLoading] = useState(false);
  const [fieldLoaded, setFieldLoaded] = useState(false);

  useEffect(() => {
    if (!tournamentId || !competitionId) return;
    loadFieldData();
  }, [competitionId, tournamentId]);

  async function loadFieldData() {
    setFieldLoading(true);
    try {
      // Fetch tournament results with golfer names and sportsdata IDs
      const { data: results } = await supabase
        .from('tournament_results')
        .select('golfer_id, position, total_to_par, made_cut, withdrew, golfers(display_name, sportsdata_id)')
        .eq('tournament_id', tournamentId);

      // Fetch draft picks for this competition
      const { data: picks } = await supabase
        .from('draft_picks')
        .select('golfer_id, user_id, draft_round')
        .eq('competition_id', competitionId);

      // Fetch alternates
      const { data: alternates } = await supabase
        .from('alternates')
        .select('golfer_id, user_id')
        .eq('competition_id', competitionId);

      // Collect all user IDs and fetch their profiles
      const userIds = [
        ...new Set([
          ...(picks ?? []).map((p) => p.user_id),
          ...(alternates ?? []).map((a) => a.user_id),
        ]),
      ];

      const { data: profiles } = userIds.length
        ? await supabase
            .from('user_profiles')
            .select('id, display_name, team_color')
            .in('id', userIds)
        : { data: [] };

      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

      // Build draft map: golfer_id → { userId, draftRound, displayName, teamColor }
      const draftMap = new Map(
        (picks ?? []).map((p) => {
          const profile = profileMap.get(p.user_id);
          return [
            p.golfer_id,
            {
              userId: p.user_id,
              draftRound: p.draft_round,
              displayName: profile?.display_name ?? 'Player',
              teamColor: profile?.team_color ?? null,
            },
          ];
        })
      );

      // Build alternate map: golfer_id → { userId, displayName, teamColor }
      const alternateMap = new Map(
        (alternates ?? []).map((a) => {
          const profile = profileMap.get(a.user_id);
          return [
            a.golfer_id,
            {
              userId: a.user_id,
              displayName: profile?.display_name ?? 'Player',
              teamColor: profile?.team_color ?? null,
            },
          ];
        })
      );

      // Build sportsdata_id → golfer_id mapping for live data merge
      const sportsdataToGolfer = new Map<string, string>();
      for (const r of (results ?? []) as any[]) {
        const rawGolfer = Array.isArray(r.golfers) ? r.golfers[0] : r.golfers;
        if (rawGolfer?.sportsdata_id) {
          sportsdataToGolfer.set(rawGolfer.sportsdata_id, r.golfer_id);
        }
      }

      // Fetch live THRU/TODAY data if tournament is active
      const liveDataMap = new Map<string, { thru: string | null; today: number | null }>();
      if (sportsdataId && tournamentStatus === 'active') {
        try {
          const { getPlayerRoundScores, getTournamentLeaderboard } = await import('@/lib/api/sportsdata');
          const [rsRaw, lbRaw] = await Promise.all([
            getPlayerRoundScores(sportsdataId),
            getTournamentLeaderboard(sportsdataId),
          ]);

          const rsPlayers: any[] = Array.isArray(rsRaw) ? rsRaw : [];
          const lbData = lbRaw as any;

          // Determine current round
          const tournRounds: any[] = lbData?.Tournament?.Rounds ?? [];
          let curRound = 1;
          for (const rd of tournRounds) {
            if (rd.IsRoundOver === true) {
              curRound = Math.max(curRound, (rd.Number ?? 0) + 1);
            }
          }
          curRound = Math.min(curRound, 4);

          const coursePar: number = lbData?.Tournament?.Par ?? 72;

          // Build TotalThrough map from Leaderboard
          const thruMap = new Map<number, number | null>();
          for (const lp of (lbData?.Players ?? []) as any[]) {
            thruMap.set(lp.PlayerID, lp.TotalThrough ?? null);
          }

          // Format tee time
          const fmtTeeTime = (iso: string | null): string | null => {
            if (!iso) return null;
            try {
              const d = new Date(iso);
              return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' });
            } catch { return null; }
          };

          // Build live data for each player
          for (const p of rsPlayers) {
            if (p.TotalScore == null) continue;
            const golferId = sportsdataToGolfer.get(String(p.PlayerID));
            if (!golferId) continue;

            const totalToPar = Math.round(p.TotalScore);
            const rounds: any[] = p.PlayerRoundScore ?? [];
            const currentRd = rounds.find((r: any) => r.Number === curRound);
            const rdPar = currentRd?.Par ?? 0;
            const rdScore = currentRd?.Score ?? 0;
            const rdTeeTime = currentRd?.TeeTime ?? null;

            let today: number | null = null;
            let thru: string | null = null;

            if (!currentRd || (rdPar === 0 && rdScore === 0)) {
              today = null;
              thru = fmtTeeTime(rdTeeTime);
            } else {
              // Derive TODAY = TotalScore - sum(prior completed rounds)
              const priorToPar = rounds
                .filter((r: any) => r.Number < curRound && r.Par > 0 && r.Score > 0)
                .reduce((sum: number, r: any) => sum + (r.Score - r.Par), 0);
              today = totalToPar - priorToPar;

              if (rdPar >= coursePar) {
                thru = 'F';
              } else {
                const lbThru = thruMap.get(p.PlayerID);
                thru = lbThru != null ? String(lbThru) : null;
              }
            }

            liveDataMap.set(golferId, { thru, today });
          }
        } catch {
          // Silently fail — THRU/TODAY just won't show
        }
      }

      // Build full field entries from tournament results
      const entries: FieldEntry[] = (results ?? []).map((r: any) => {
        const rawGolfer = Array.isArray(r.golfers) ? r.golfers[0] : r.golfers;
        const golferName: string = rawGolfer?.display_name ?? 'Unknown';
        const draftInfo = draftMap.get(r.golfer_id);
        const altInfo = alternateMap.get(r.golfer_id);
        const liveData = liveDataMap.get(r.golfer_id);

        return {
          golferId: r.golfer_id,
          golferName,
          rank: r.position ?? null,
          scoreToPar: r.total_to_par ?? null,
          madeCut: r.made_cut ?? null,
          withdrew: r.withdrew ?? false,
          draftedByUserId: draftInfo?.userId ?? null,
          draftedByDisplayName: draftInfo?.displayName ?? null,
          draftedByColor: draftInfo?.teamColor ?? null,
          draftRound: draftInfo?.draftRound ?? null,
          isAlternateFor: altInfo?.userId ?? null,
          alternateOwnerColor: altInfo?.teamColor ?? null,
          alternateOwnerName: altInfo?.displayName ?? null,
          thru: liveData?.thru ?? null,
          today: liveData?.today ?? null,
        };
      });

      // Sort by rank (nulls last), then by name
      entries.sort((a, b) => {
        if (a.rank === null && b.rank === null) return a.golferName.localeCompare(b.golferName);
        if (a.rank === null) return 1;
        if (b.rank === null) return -1;
        return a.rank - b.rank;
      });

      setFieldEntries(entries);
      setFieldLoaded(true);
    } catch (err) {
      console.error('CompetitionTabs field load error:', err);
    } finally {
      setFieldLoading(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'teams', label: 'Teams' },
    { id: 'field', label: 'Full Field' },
    { id: 'drafted', label: 'Drafted' },
    { id: 'results', label: 'Results' },
  ];

  const draftedEntries = fieldEntries.filter(
    (e) => e.draftedByUserId !== null || e.isAlternateFor !== null
  );

  return (
    <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-1.5 px-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === tab.id
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading state (leaderboard) */}
      {lbLoading && (
        <div className="flex items-center gap-2 py-4">
          <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading scores…</p>
        </div>
      )}

      {lbError && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
          <p className="text-sm text-red-700">{lbError.message}</p>
        </div>
      )}

      {/* Tab content */}
      {!lbLoading && !lbError && (
        <>
          {activeTab === 'teams' && (
            <TeamsView
              leaderboard={leaderboard}
              currentUserId={currentUserId}
              tournamentStatus={tournamentStatus}
              competitionId={competitionId}
            />
          )}

          {activeTab === 'field' && (
            <>
              {fieldLoading && !fieldLoaded && (
                <div className="flex items-center gap-2 py-4">
                  <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-gray-400">Loading field…</p>
                </div>
              )}
              {(!fieldLoading || fieldLoaded) && (
                <FieldTable
                  entries={fieldEntries}
                  currentUserId={currentUserId}
                  emptyMessage="Tournament scores will appear here once the tournament is underway."
                />
              )}
            </>
          )}

          {activeTab === 'drafted' && (
            <>
              {fieldLoading && !fieldLoaded && (
                <div className="flex items-center gap-2 py-4">
                  <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-gray-400">Loading picks…</p>
                </div>
              )}
              {(!fieldLoading || fieldLoaded) && (
                <FieldTable
                  entries={draftedEntries}
                  currentUserId={currentUserId}
                  emptyMessage="Drafted players and alternates will appear here."
                />
              )}
            </>
          )}

          {activeTab === 'results' && (
            <ResultsView leaderboard={leaderboard} currentUserId={currentUserId} />
          )}
        </>
      )}
    </div>
  );
}
