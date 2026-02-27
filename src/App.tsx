import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { LoginPage } from '@/features/auth/components/LoginPage';
import { SignupPage } from '@/features/auth/components/SignupPage';
import { TournamentList } from '@/features/tournaments/components/TournamentList';
import { TournamentDetail } from '@/features/tournaments/components/TournamentDetail';
import { CompetitionList } from '@/features/competitions/components/CompetitionList';
import { CompetitionDetail } from '@/features/competitions/components/CompetitionDetail';
import { AnnualLeaderboardPage } from '@/features/leaderboard/components/AnnualLeaderboardPage';
import { JoinPage } from '@/features/competitions/components/JoinPage';
import { ProfilePage } from '@/features/profile/components/ProfilePage';
import { HomePage } from '@/features/home/components/HomePage';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useMyAnnualStats } from '@/features/leaderboard/hooks/useMyAnnualStats';
import { useCompetitions } from '@/features/competitions/hooks/useCompetitions';
import { useCompetitionLeaderboard } from '@/features/competitions/hooks/useCompetitionLeaderboard';
import { getCompetitionHistory } from '@/features/competitions/services/competitionHistoryService';
import type { CompetitionHistoryEntry } from '@/features/competitions/services/competitionHistoryService';
import './App.css';

/**
 * Root App component.
 */
function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          {/* The homepage manages its own full-bleed layout; all other pages use the shared shell */}
          <Routes>
            <Route path="/" element={<HomeLayout />} />
            <Route path="*" element={<AppShell />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

/**
 * HomeLayout — homepage gets its own dark full-bleed treatment with Header on top.
 */
function HomeLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      <Header />
      <main className="flex-1">
        <HomePage />
      </main>
    </div>
  );
}

/**
 * AppShell — all inner pages share this layout:
 *   dark Header → light gray content area → dark Footer
 */
function AppShell() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <PageContainer>
                  <DashboardPage />
                </PageContainer>
              </ProtectedRoute>
            }
          />
          <Route
            path="/leaderboard"
            element={
              <ProtectedRoute>
                <AnnualLeaderboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tournaments"
            element={
              <ProtectedRoute>
                <PageContainer>
                  <TournamentList />
                </PageContainer>
              </ProtectedRoute>
            }
          />
          <Route
            path="/tournaments/:id"
            element={
              <ProtectedRoute>
                <PageContainer>
                  <TournamentDetail />
                </PageContainer>
              </ProtectedRoute>
            }
          />
          <Route
            path="/competitions"
            element={
              <ProtectedRoute>
                <PageContainer>
                  <CompetitionList />
                </PageContainer>
              </ProtectedRoute>
            }
          />
          <Route
            path="/competitions/:id"
            element={
              <ProtectedRoute>
                <PageContainer>
                  <CompetitionDetail />
                </PageContainer>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          {/* Public route: invite link */}
          <Route path="/join/:inviteCode" element={<PageContainer><JoinPage /></PageContainer>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

/**
 * Standard content container — max-width, horizontal padding, vertical spacing.
 */
function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {children}
    </div>
  );
}

// ─── Dashboard helpers ────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();

/** Format net dollar: "+$X.XX" green or "-$X.XX" red */
function NetDollar({ value }: { value: number }) {
  const pos = value >= 0;
  return (
    <span className={`font-semibold text-sm ${pos ? 'text-green-600' : 'text-red-500'}`}>
      {pos ? '+' : '-'}${Math.abs(value).toFixed(2)}
    </span>
  );
}

/** Ordinal suffix: 1 → "1st", 2 → "2nd", etc. */
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Score to par display: 0 → "E", positive → "+N", negative → "N" */
function scoreToPar(n: number): string {
  if (n === 0) return 'E';
  return n > 0 ? `+${n}` : `${n}`;
}

/** Score color for leaderboard values */
function scoreColor(n: number): string {
  if (n < 0) return 'text-red-600 font-bold';
  if (n > 0) return 'text-blue-600';
  return 'text-gray-700';
}

const COLOR_DOT_MAP: Record<string, string> = {
  yellow: 'bg-yellow-400',
  red: 'bg-red-500',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
};

// ─── Live Competition Preview (for Dashboard) ────────────────────────────

function LiveCompetitionPreview({ competitionId, competitionName }: {
  competitionId: string;
  competitionName: string;
}) {
  const { leaderboard, loading } = useCompetitionLeaderboard(competitionId);

  if (loading || leaderboard.length === 0) return null;

  return (
    <Link to={`/competitions/${competitionId}`} className="block group">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all">
        <div className="h-1 bg-green-500" />
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                LIVE
              </span>
              <h3 className="font-semibold text-gray-900">{competitionName}</h3>
            </div>
            <span className="text-xs text-gray-400 group-hover:text-green-600 transition-colors">View Details →</span>
          </div>
          {/* Mini team leaderboard */}
          <div className="space-y-1.5">
            {leaderboard.map((entry) => (
              <div key={entry.userId} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400 w-5">{ordinal(entry.finalPosition)}</span>
                  {entry.teamColor && entry.teamColor in COLOR_DOT_MAP && (
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${COLOR_DOT_MAP[entry.teamColor]}`} />
                  )}
                  <span className="font-medium text-gray-700">{entry.displayName}</span>
                </div>
                <span className={`font-mono font-semibold ${scoreColor(entry.teamScoreToPar)}`}>
                  {scoreToPar(entry.teamScoreToPar)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Section 1: Annual Stats Card ─────────────────────────────────────────

function AnnualStatsCard({ userId }: { userId: string }) {
  const { stats, loading } = useMyAnnualStats(userId, CURRENT_YEAR);

  if (loading) return null; // Don't flash a spinner here — card appears when ready

  if (!stats) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-gray-900">{CURRENT_YEAR} Season</h2>
          <Link
            to="/leaderboard"
            className="text-xs text-green-600 hover:text-green-700 font-medium"
          >
            View Full Leaderboard →
          </Link>
        </div>
        <p className="text-sm text-gray-400">
          Your stats will appear here after your first completed tournament.
        </p>
      </div>
    );
  }

  const total = stats.total_winnings + stats.total_bounties;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Color bar */}
      <div className="h-1 flex">
        <div className="flex-1 bg-green-500" />
        <div className="flex-1 bg-red-500" />
        <div className="flex-1 bg-blue-500" />
        <div className="flex-1 bg-yellow-400" />
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">{CURRENT_YEAR} Season</h2>
          <Link
            to="/leaderboard"
            className="text-xs text-green-600 hover:text-green-700 font-medium"
          >
            View Full Leaderboard →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1">
              Played
            </p>
            <p className="text-2xl font-bold text-gray-900">{stats.total_competitions}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1">
              Wins
            </p>
            <p className="text-2xl font-bold text-gray-900">{stats.competitions_won}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1">
              Winnings
            </p>
            <p className="text-2xl font-bold">
              <NetDollar value={stats.total_winnings} />
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1">
              Bounties
            </p>
            <p className="text-2xl font-bold">
              <NetDollar value={stats.total_bounties} />
            </p>
          </div>
        </div>
        {/* Total net */}
        <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
          <span className="text-sm text-gray-500">Net total (winnings + bounties)</span>
          <NetDollar value={total} />
        </div>
      </div>
    </div>
  );
}

// ─── Section 2 & 3: Competition History ───────────────────────────────────

function CompetitionHistorySection({
  userId,
  isPublic,
}: {
  userId: string;
  isPublic: boolean;
}) {
  const [entries, setEntries] = useState<CompetitionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getCompetitionHistory(userId, isPublic)
      .then((data) => { if (!cancelled) setEntries(data); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err : new Error(String(err))); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, isPublic]);

  const title = isPublic ? 'Public Tournament History' : 'Private Competition History';
  const emptyMsg = isPublic
    ? 'Public tournament results will appear here once competitions finish.'
    : 'Private competition results will appear here once competitions finish.';

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>

      {loading && (
        <div className="flex items-center gap-2 py-4">
          <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading history…</p>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
          <p className="text-sm text-red-700">{error.message}</p>
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-8 text-center">
          <p className="text-gray-400 text-sm">{emptyMsg}</p>
        </div>
      )}

      {!loading && !error && entries.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Tournament
                  </th>
                  {!isPublic && (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Competition
                    </th>
                  )}
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Finish
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Winnings
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Bounties
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map((entry) => (
                  <tr
                    key={entry.competition_id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {entry.tournament_name}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(entry.tournament_end_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                    </td>
                    {!isPublic && (
                      <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-600">
                        {entry.competition_name}
                      </td>
                    )}
                    <td className="px-4 py-3.5 whitespace-nowrap text-right">
                      <span className="text-sm font-medium text-gray-900">
                        {ordinal(entry.final_position)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-right">
                      <span
                        className={`text-sm font-medium ${
                          entry.team_score_to_par < 0
                            ? 'text-green-600'
                            : entry.team_score_to_par === 0
                            ? 'text-gray-600'
                            : 'text-red-500'
                        }`}
                      >
                        {scoreToPar(entry.team_score_to_par)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-right">
                      <NetDollar value={entry.net_winnings} />
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-right">
                      <NetDollar value={entry.net_bounties} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard page ────────────────────────────────────────────────────────

/**
 * Dashboard page — annual stats + competition history + active/upcoming competitions.
 */
function DashboardPage() {
  const { user } = useAuth();
  const { competitions } = useCompetitions();

  // Find competitions with completed drafts for active tournaments
  const liveCompetitions = (competitions ?? []).filter(
    (c) => c.draft_status === 'completed' && c.tournament?.status === 'active'
  );

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">My Dashboard</h1>

      {/* Section 1: Annual summary stats card */}
      {user && <AnnualStatsCard userId={user.id} />}

      {/* Section 1.5: Live tournament preview for active competitions */}
      {liveCompetitions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Live Tournament</h2>
          {liveCompetitions.map((c) => (
            <LiveCompetitionPreview key={c.id} competitionId={c.id} competitionName={c.name} />
          ))}
        </div>
      )}

      {/* Section 2: Active / upcoming competitions */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">My Competitions</h2>
        <CompetitionList />
      </div>

      {/* Section 3: Public competition history */}
      {user && <CompetitionHistorySection userId={user.id} isPublic={true} />}

      {/* Section 4: Private competition history */}
      {user && <CompetitionHistorySection userId={user.id} isPublic={false} />}
    </div>
  );
}

export default App;
