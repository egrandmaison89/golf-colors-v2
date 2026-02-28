/**
 * HomePage
 *
 * Public landing page featuring:
 *  - Hero section with brand identity (green, red, blue, yellow)
 *  - Live PGA leaderboard for the current/upcoming tournament
 *    (switches to next week's tournament on Wednesdays)
 *  - How It Works / scoring system explanation
 *  - CTA to sign up or log in
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase/client';
import { getTournamentLeaderboard, getPlayerRoundScores } from '@/lib/api/sportsdata';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Tournament {
  id: string;
  sportsdata_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  course_name: string | null;
  purse: number | null;
}

interface LeaderEntry {
  name: string;
  position: string | number | null;
  totalScore: number | null; // to-par (negative = under)
  totalStrokes: number | null;
  thru: string | null;
  madeCut: boolean | null;
  withdrew: boolean | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatScore(score: number | null): string {
  if (score === null) return '—';
  if (score === 0) return 'E';
  return score > 0 ? `+${score}` : `${score}`;
}

function formatPurse(purse: number | null): string {
  if (!purse) return '';
  if (purse >= 1_000_000) return `$${(purse / 1_000_000).toFixed(1)}M`;
  if (purse >= 1_000) return `$${(purse / 1_000).toFixed(0)}K`;
  return `$${purse}`;
}

/**
 * Determine which tournament to show on the homepage.
 * On Wednesday (day === 3) or later in the week, show the NEXT tournament.
 * Otherwise show the active/closest upcoming.
 */
function pickFeaturedTournament(tournaments: Tournament[]): Tournament | null {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun … 3=Wed … 6=Sat

  // Active first
  const active = tournaments.find((t) => t.status === 'active');
  if (active) return active;

  const upcoming = tournaments
    .filter((t) => t.status === 'upcoming')
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  if (upcoming.length === 0) return null;

  // Wednesday (3) or later → show next week's tournament (skip the first upcoming if it starts this week)
  if (dayOfWeek >= 3 && upcoming.length > 1) {
    const thisWeekStart = upcoming[0].start_date;
    // If first upcoming starts Thu/Fri of this same week, skip to next
    const daysDiff = (new Date(thisWeekStart).getTime() - now.getTime()) / 86_400_000;
    if (daysDiff < 3) return upcoming[1] ?? upcoming[0];
  }

  return upcoming[0];
}

// ─── Score color helper ───────────────────────────────────────────────────────

function scoreColor(score: number | null): string {
  if (score === null) return 'text-gray-400';
  if (score < 0) return 'text-red-600 font-bold';
  if (score > 0) return 'text-blue-600';
  return 'text-gray-700';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ColorBar() {
  return (
    <div className="h-1.5 w-full flex">
      <div className="flex-1 bg-green-500" />
      <div className="flex-1 bg-red-500" />
      <div className="flex-1 bg-blue-500" />
      <div className="flex-1 bg-yellow-400" />
    </div>
  );
}

function TeamColorDot({ color }: { color: 'green' | 'red' | 'blue' | 'yellow' }) {
  const cls = {
    green: 'bg-green-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    yellow: 'bg-yellow-400',
  }[color];
  return <span className={`inline-block w-3 h-3 rounded-full ${cls}`} />;
}

// ─── Live Leaderboard Component ───────────────────────────────────────────────

function TournamentLeaderboard() {
  const { user } = useAuth();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myCompetition, setMyCompetition] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  // Find user's competition for the featured tournament
  useEffect(() => {
    if (!user || !tournament) return;
    supabase
      .from('competition_participants')
      .select('competition_id, competitions(id, name, tournament_id)')
      .eq('user_id', user.id)
      .then(({ data }) => {
        const match = (data ?? []).find((p: any) => {
          const comp = Array.isArray(p.competitions) ? p.competitions[0] : p.competitions;
          return comp?.tournament_id === tournament.id;
        });
        if (match) {
          const comp = Array.isArray(match.competitions) ? match.competitions[0] : match.competitions;
          if (comp) setMyCompetition({ id: comp.id, name: comp.name });
        }
      });
  }, [user?.id, tournament?.id]);

  async function loadLeaderboard() {
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch tournaments from our DB cache
      const { data: tournaments } = await supabase
        .from('tournaments')
        .select('id, sportsdata_id, name, start_date, end_date, status, course_name, purse')
        .order('start_date', { ascending: true });

      if (!tournaments || tournaments.length === 0) {
        setError('No tournaments available.');
        return;
      }

      const featured = pickFeaturedTournament(tournaments as Tournament[]);
      if (!featured) {
        setError('No upcoming tournaments found.');
        return;
      }

      setTournament(featured);

      // 2. Only call APIs for active tournaments.
      //    Upcoming tournaments have no scores yet — skip API calls entirely
      //    and let the "Tournament begins [date]" empty-state render naturally.
      if (featured.status !== 'active') {
        setLeaders([]);
        return;
      }

      // 3. Fetch REAL scoring data + supplementary leaderboard data.
      //    - PlayerTournamentRoundScores: real scores (TotalScore, per-round Score/Par, TeeTime)
      //    - Leaderboard: TotalThrough (holes completed) + Tournament.Rounds[].IsRoundOver
      //    The Leaderboard endpoint returns DFS-scrambled SCORES (do NOT use for scoring),
      //    but structural fields (TotalThrough, IsRoundOver) are still accurate.
      try {
        const [roundScoresRaw, leaderboardRaw] = await Promise.all([
          getPlayerRoundScores(featured.sportsdata_id),
          getTournamentLeaderboard(featured.sportsdata_id),
        ]);

        const rsPlayers: any[] = Array.isArray(roundScoresRaw) ? roundScoresRaw : [];
        const lbData = leaderboardRaw as any;

        if (rsPlayers.length === 0) {
          setLeaders([]);
          return;
        }

        // Determine current round from Tournament.Rounds[].IsRoundOver
        const tournamentRounds: any[] = lbData?.Tournament?.Rounds ?? [];
        let currentRound = 1;
        for (const r of tournamentRounds) {
          if (r.IsRoundOver === true) {
            currentRound = Math.max(currentRound, (r.Number ?? 0) + 1);
          }
        }
        currentRound = Math.min(currentRound, 4);

        // Only consider cut as made when at least one player has round 3+ data.
        // This prevents false "MC" labels during the gap between R2 ending and R3 starting.
        const anyoneHasRound3 = rsPlayers.some((p: any) =>
          (p.PlayerRoundScore ?? []).some((r: any) => r.Number >= 3 && r.Par > 0)
        );
        const cutHasBeenMade = currentRound >= 3 && anyoneHasRound3;

        // Get course par from Tournament (or default to 72)
        const coursePar: number = lbData?.Tournament?.Par ?? 72;

        // Build TotalThrough map from Leaderboard (structural, not scrambled)
        const thruMap = new Map<number, number | null>();
        for (const p of (lbData?.Players ?? []) as any[]) {
          thruMap.set(p.PlayerID, p.TotalThrough ?? null);
        }

        // Format tee time for display (e.g., "1:23 PM")
        const formatTeeTime = (isoStr: string | null): string | null => {
          if (!isoStr) return null;
          try {
            const d = new Date(isoStr);
            return d.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
              timeZone: 'America/New_York',
            });
          } catch {
            return null;
          }
        };

        // Filter out withdrawn players (TotalScore is null)
        // and sort by TotalScore ascending (lowest = best)
        const activePlayers = rsPlayers
          .filter((p: any) => p.TotalScore != null)
          .sort((a: any, b: any) => a.TotalScore - b.TotalScore);

        // Assign positions with tie handling
        const positions = new Map<number, number>();
        let pos = 1;
        for (let i = 0; i < activePlayers.length; i++) {
          if (i > 0 && activePlayers[i].TotalScore !== activePlayers[i - 1].TotalScore) {
            pos = i + 1;
          }
          positions.set(activePlayers[i].PlayerID, pos);
        }

        // Build top 15 leaderboard entries
        const parsed: LeaderEntry[] = activePlayers
          .slice(0, 15)
          .map((p: any) => {
            const totalToPar = Math.round(p.TotalScore);
            const rounds: any[] = p.PlayerRoundScore ?? [];

            // Find current round data for THRU display
            const currentRd = rounds.find((r: any) => r.Number === currentRound);
            const rdPar = currentRd?.Par ?? 0;
            const rdScore = currentRd?.Score ?? 0;
            const rdTeeTime = currentRd?.TeeTime ?? null;

            let thru: string | null = null;

            if (!currentRd || (rdPar === 0 && rdScore === 0)) {
              // Player hasn't started today's round → show tee time
              thru = formatTeeTime(rdTeeTime);
            } else if (rdPar >= coursePar) {
              thru = 'F';
            } else {
              const lbThru = thruMap.get(p.PlayerID);
              thru = lbThru != null ? String(lbThru) : null;
            }

            // Determine made_cut: only after round 3+ begins
            const hasRound3Plus = rounds.some((r: any) => r.Number >= 3 && r.Par > 0);
            const madeCut: boolean | null = cutHasBeenMade ? hasRound3Plus : null;

            return {
              name: `${p.FirstName ?? ''} ${p.LastName ?? ''}`.trim() || 'Unknown',
              position: positions.get(p.PlayerID) ?? null,
              totalScore: totalToPar,
              totalStrokes: p.TotalStrokes != null ? Math.round(p.TotalStrokes) : null,
              thru,
              madeCut,
              withdrew: false, // filtered out above
            };
          });

        setLeaders(parsed);
      } catch (apiErr) {
        // API failure (401, rate limit, SportsData outage, edge function down, etc.)
        // Degrade gracefully: show tournament info + "check back for scores" empty state.
        console.warn('Leaderboard API unavailable, showing empty state:', apiErr);
        setLeaders([]);
      }
    } catch (err) {
      // DB failure: something fundamentally broken — show error state
      console.error('Leaderboard load error:', err);
      setError('Could not load leaderboard right now.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Loading leaderboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-gray-400 text-sm text-center py-10">{error}</p>
    );
  }

  const isActive = tournament?.status === 'active';
  const startDate = tournament
    ? new Date(tournament.start_date).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : '';

  return (
    <div>
      {/* Tournament header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-0.5">
          {isActive && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              LIVE
            </span>
          )}
          {!isActive && (
            <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              UPCOMING
            </span>
          )}
        </div>
        <h3 className="text-xl font-bold text-gray-900">{tournament?.name}</h3>
        <p className="text-sm text-gray-500">
          {tournament?.course_name ?? ''}{tournament?.course_name ? ' · ' : ''}{startDate}
          {tournament?.purse ? ` · ${formatPurse(tournament.purse)} purse` : ''}
        </p>
        {myCompetition && (
          <Link
            to={`/competitions/${myCompetition.id}`}
            className="inline-flex items-center gap-1.5 mt-2 text-sm font-semibold text-green-500 hover:text-green-400 transition-colors"
          >
            View My Competition: {myCompetition.name} →
          </Link>
        )}
      </div>

      {/* No scores yet */}
      {leaders.length === 0 && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-6 text-center">
          <p className="text-gray-500 text-sm">
            Tournament begins {startDate}. Check back once play begins for live scores.
          </p>
        </div>
      )}

      {/* Leaderboard table */}
      {leaders.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left pl-4 pr-2 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide w-8">Pos</th>
                <th className="text-left px-2 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Player</th>
                <th className="text-right px-2 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Total</th>
                <th className="text-right pr-4 pl-2 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide hidden sm:table-cell">Thru</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {leaders.map((entry, i) => (
                <tr
                  key={i}
                  className={`hover:bg-gray-50 transition-colors ${i < 3 ? 'bg-white' : ''}`}
                >
                  <td className="pl-4 pr-2 py-2.5 text-gray-500 font-medium text-xs w-8">
                    {entry.withdrew ? 'WD' : entry.madeCut === false ? 'MC' : (entry.position ?? i + 1)}
                  </td>
                  <td className="px-2 py-2.5 font-medium text-gray-900">
                    <span className="flex items-center gap-2">
                      {i === 0 && <span className="text-base">🏆</span>}
                      {entry.name}
                    </span>
                  </td>
                  <td className={`px-2 py-2.5 text-right font-mono font-semibold ${scoreColor(entry.totalScore)}`}>
                    {formatScore(entry.totalScore)}
                  </td>
                  <td className="pr-4 pl-2 py-2.5 text-right text-gray-400 text-xs hidden sm:table-cell">
                    {entry.thru ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="bg-gray-50 border-t border-gray-100 px-4 py-2 text-xs text-gray-400 text-right">
            Via SportsData.io · Top 15 shown
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Scoring Section ──────────────────────────────────────────────────────────

function ScoringSection() {
  const steps = [
    {
      icon: '🏌️',
      title: 'Draft Your Team',
      desc: 'Each player picks 3 PGA Tour golfers in a snake draft before the tournament starts. Pick order is randomized — everyone has a fair shot at the top talent.',
    },
    {
      icon: '⛳',
      title: 'Live Scoring',
      desc: "Your team's score is the sum of your 3 golfers' scores to par. Lower is better — birdie-heavy rounds mean your team climbs the leaderboard.",
    },
    {
      icon: '🔄',
      title: 'Missed Cut & Withdrawals',
      desc: "If a golfer misses the cut, their two-round total is doubled as a penalty. If they withdraw, you can sub in your pre-selected alternate golfer.",
    },
    {
      icon: '🏆',
      title: 'Win the Bounty',
      desc: 'The player whose team finishes with the lowest total score wins the weekly bounty. Bragging rights included at no extra charge.',
    },
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-block text-xs font-bold tracking-widest uppercase text-green-600 mb-3">Scoring System</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">Simple rules, serious competition.</h2>
          <p className="mt-3 text-gray-500 text-lg max-w-2xl mx-auto">
            Golf Colors is a weekly draft game built around real PGA Tour results. Here's how your score works.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {steps.map((s) => (
            <div
              key={s.title}
              className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="text-3xl mb-3">{s.icon}</div>
              <h3 className="text-base font-bold text-gray-900 mb-2">{s.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Score example */}
        <div className="mt-10 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Example: Your Team This Week</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 font-medium text-gray-400">Golfer</th>
                  <th className="text-right py-2 font-medium text-gray-400">Score</th>
                  <th className="text-right py-2 font-medium text-gray-400 hidden sm:table-cell">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[
                  { name: 'Scottie Scheffler', score: -12, note: 'Made cut ✓' },
                  { name: 'Rory McIlroy', score: -8, note: 'Made cut ✓' },
                  { name: 'Tommy Fleetwood', score: +6, note: 'Missed cut (×2 penalty)' },
                ].map((row) => (
                  <tr key={row.name}>
                    <td className="py-2.5 text-gray-800 font-medium">{row.name}</td>
                    <td className={`py-2.5 text-right font-mono font-semibold ${scoreColor(row.score)}`}>
                      {formatScore(row.score)}
                    </td>
                    <td className="py-2.5 text-right text-gray-400 text-xs hidden sm:table-cell">{row.note}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-200">
                  <td className="py-2.5 font-bold text-gray-900">Team Total</td>
                  <td className="py-2.5 text-right font-mono font-bold text-lg text-red-600">-14</td>
                  <td className="py-2.5 text-right text-xs text-gray-400 hidden sm:table-cell">−12 + (−8) + 6 = −14</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-gray-400">
            * Missed-cut penalty: Tommy's two-round total of +3 is doubled to +6.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Main HomePage ────────────────────────────────────────────────────────────

export function HomePage() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-white">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gray-950 text-white">
        {/* Color band at top */}
        <ColorBar />

        {/* Decorative blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-green-600 opacity-10 blur-3xl" />
          <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-blue-600 opacity-10 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-red-600 opacity-5 blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 lg:py-40">
          <div className="max-w-3xl">
            {/* Color dots as brand element */}
            <div className="flex gap-2 mb-6">
              {(['green', 'red', 'blue', 'yellow'] as const).map((c) => (
                <TeamColorDot key={c} color={c} />
              ))}
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-none mb-6">
              <span className="text-white">Golf</span>
              <span className="ml-3 text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-blue-400 to-yellow-300">
                Colors
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-gray-300 leading-relaxed mb-10 max-w-xl">
              Pick your team. Draft PGA Tour golfers. Compete with friends every week.
              The lowest combined score wins the pot.
            </p>

            <div className="flex flex-wrap gap-4">
              {user ? (
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 px-7 py-3.5 bg-green-500 hover:bg-green-400 text-white font-bold rounded-xl text-base shadow-lg shadow-green-900/30 transition-all hover:scale-105"
                >
                  Go to Dashboard →
                </Link>
              ) : (
                <>
                  <Link
                    to="/signup"
                    className="inline-flex items-center gap-2 px-7 py-3.5 bg-green-500 hover:bg-green-400 text-white font-bold rounded-xl text-base shadow-lg shadow-green-900/30 transition-all hover:scale-105"
                  >
                    Get Started Free →
                  </Link>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 px-7 py-3.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl text-base border border-white/20 transition-all"
                  >
                    Sign In
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Color band at bottom */}
        <ColorBar />
      </section>

      {/* ── How it works strip ── */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {[
              { color: 'green', emoji: '🎲', label: 'Weekly Drafts' },
              { color: 'red', emoji: '⛳', label: 'Live PGA Scoring' },
              { color: 'blue', emoji: '🏆', label: 'Weekly Bounties' },
              { color: 'yellow', emoji: '👥', label: 'Play with Friends' },
            ].map(({ color, emoji, label }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm ${
                    color === 'green' ? 'bg-green-50' :
                    color === 'red' ? 'bg-red-50' :
                    color === 'blue' ? 'bg-blue-50' :
                    'bg-yellow-50'
                  }`}
                >
                  {emoji}
                </div>
                <span className="text-sm font-semibold text-gray-700">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Live Leaderboard ── */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">

            {/* Left: leaderboard */}
            <div className="lg:col-span-3">
              <span className="inline-block text-xs font-bold tracking-widest uppercase text-green-600 mb-2">This Week on Tour</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-6">
                Live PGA Leaderboard
              </h2>
              <TournamentLeaderboard />
            </div>

            {/* Right: join CTA */}
            <div className="lg:col-span-2 flex flex-col justify-center">
              {/* Color swatch card */}
              <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm mb-6">
                <div className="grid grid-cols-4 h-3">
                  <div className="bg-green-500" />
                  <div className="bg-red-500" />
                  <div className="bg-blue-500" />
                  <div className="bg-yellow-400" />
                </div>
                <div className="p-6 bg-gray-50">
                  <h3 className="font-bold text-gray-900 text-lg mb-2">Pick your color.</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Every player on Golf Colors represents a team color. Your color follows you through
                    the draft, the leaderboard, and the final standings.
                  </p>
                  <div className="flex gap-2">
                    {(['green', 'red', 'blue', 'yellow'] as const).map((c) => {
                      const cls = {
                        green: 'bg-green-500',
                        red: 'bg-red-500',
                        blue: 'bg-blue-500',
                        yellow: 'bg-yellow-400',
                      }[c];
                      const label = c.charAt(0).toUpperCase() + c.slice(1);
                      return (
                        <div key={c} className={`flex-1 rounded-lg ${cls} h-10 flex items-center justify-center`}>
                          <span className="text-white text-xs font-bold">{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 shadow-sm p-6 bg-white">
                <h3 className="font-bold text-gray-900 text-lg mb-2">Ready to play?</h3>
                <p className="text-sm text-gray-500 mb-5">
                  Create a private competition with your group or join the public weekly draft.
                  Free to play, fun to win.
                </p>
                {user ? (
                  <Link
                    to="/dashboard"
                    className="block w-full text-center px-5 py-3 bg-gray-900 hover:bg-gray-700 text-white font-bold rounded-xl text-sm transition-colors"
                  >
                    Go to Dashboard →
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/signup"
                      className="block w-full text-center px-5 py-3 bg-gray-900 hover:bg-gray-700 text-white font-bold rounded-xl text-sm transition-colors"
                    >
                      Create an Account →
                    </Link>
                    <Link
                      to="/login"
                      className="block w-full text-center mt-2 px-5 py-3 text-gray-500 hover:text-gray-900 text-sm font-medium transition-colors"
                    >
                      Already have an account? Sign in
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Scoring explanation ── */}
      <ScoringSection />

      {/* ── Final CTA ── */}
      <section className="bg-gray-950 py-20 relative overflow-hidden">
        <ColorBar />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-green-600 opacity-10 blur-3xl" />
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-yellow-400 opacity-10 blur-3xl" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 text-center text-white">
          <div className="flex justify-center gap-2 mb-6">
            {(['green', 'red', 'blue', 'yellow'] as const).map((c) => (
              <TeamColorDot key={c} color={c} />
            ))}
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
            Your group's weekly golf rivalry starts here.
          </h2>
          <p className="text-gray-400 text-lg mb-8">
            Free to play. Takes 2 minutes to set up. Bragging rights last all week.
          </p>
          <Link
            to={user ? '/dashboard' : '/signup'}
            className="inline-flex items-center gap-2 px-8 py-4 bg-green-500 hover:bg-green-400 text-white font-bold rounded-xl text-base shadow-lg shadow-green-900/40 transition-all hover:scale-105"
          >
            {user ? 'Go to Dashboard →' : 'Start Playing Free →'}
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-950 border-t border-gray-800 py-8">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-gray-500 text-sm">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {(['green', 'red', 'blue', 'yellow'] as const).map((c) => (
                <TeamColorDot key={c} color={c} />
              ))}
            </div>
            <span className="font-semibold text-gray-300">Golf Colors</span>
          </div>
          <p>Built for PGA Tour fans who like to compete.</p>
          <div className="flex gap-4">
            <Link to="/login" className="hover:text-white transition-colors">Sign In</Link>
            <Link to="/signup" className="hover:text-white transition-colors">Sign Up</Link>
            <Link to="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
