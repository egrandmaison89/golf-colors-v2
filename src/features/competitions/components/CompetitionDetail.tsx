/**
 * CompetitionDetail component
 *
 * Displays detailed information about a competition.
 * - Checks lazy draft auto-start on every load (maybeAutoStartDraft)
 * - Admin users see a field status panel + draft order UI before starting
 * - Shows DraftSection for participants
 * - Shows CompetitionLeaderboard after draft completes
 */

import { useParams, Link } from 'react-router-dom';
import { useCompetition } from '../hooks/useCompetition';
import { useAuth } from '@/contexts/AuthContext';
import {
  joinCompetition,
  isParticipant,
  maybeAutoStartDraft,
  getIsAdmin,
  getPreviousCompetitionForParticipants,
} from '../services/competitionService';
import { getCompetitionLeaderboard } from '../services/scoringService';
import { syncTournamentField } from '@/features/golfers/services/golferService';
import { supabase } from '@/lib/supabase/client';
import { DraftSection } from './DraftSection';
import { CompetitionTabs } from './CompetitionTabs';
import { AdminPanel } from './AdminPanel';
import { useState, useEffect, useCallback } from 'react';

const STATUS_STYLES: Record<string, { badge: string; bar: string; label: string }> = {
  not_started: { badge: 'bg-gray-100 text-gray-500 border-gray-200',   bar: 'bg-gray-300',  label: 'Not Started' },
  in_progress:  { badge: 'bg-blue-50 text-blue-700 border-blue-100',    bar: 'bg-blue-500',  label: 'Draft Live'  },
  completed:    { badge: 'bg-green-50 text-green-700 border-green-100', bar: 'bg-green-500', label: 'Complete'    },
  canceled:     { badge: 'bg-red-50 text-red-600 border-red-100',       bar: 'bg-red-500',   label: 'Canceled'    },
};

const TOURNAMENT_STATUS_STYLES: Record<string, string> = {
  upcoming:  'text-blue-600 bg-blue-50 border-blue-100',
  active:    'text-green-700 bg-green-50 border-green-100',
  completed: 'text-gray-500 bg-gray-100 border-gray-200',
};

const COLOR_DOT_CLASSES: Record<string, string> = {
  yellow: 'bg-yellow-400',
  red:    'bg-red-500',
  green:  'bg-green-500',
  blue:   'bg-blue-500',
};

interface DraftOrderEntry {
  userId: string;
  displayName: string;
  teamColor: string | null;
  /** position label shown in the list, e.g. "Previous: 1st" */
  prevPositionLabel: string | null;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export function CompetitionDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { competition, loading, error, refetch } = useCompetition(id || '');
  const [isUserParticipant, setIsUserParticipant] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // SportsData.io tournament ID for live data in CompetitionTabs
  const [sportsdataId, setSportsdataId] = useState<string | null>(null);

  // Admin: field status
  const [fieldCount, setFieldCount] = useState<number | null>(null);
  const [fieldRefreshing, setFieldRefreshing] = useState(false);

  // Admin: draft order panel
  const [showDraftOrderPanel, setShowDraftOrderPanel] = useState(false);
  const [draftOrderList, setDraftOrderList] = useState<DraftOrderEntry[]>([]);
  const [loadingDraftOrder, setLoadingDraftOrder] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [startingDraft, setStartingDraft] = useState(false);
  const [startDraftError, setStartDraftError] = useState<string | null>(null);

  // Check participant status
  useEffect(() => {
    if (competition && user) {
      isParticipant(competition.id, user.id).then(setIsUserParticipant);
    }
  }, [competition?.id, user?.id]);

  // Check admin status
  useEffect(() => {
    if (user) {
      getIsAdmin(user.id).then(setIsAdmin);
    }
  }, [user?.id]);

  // Fetch SportsData.io tournament ID for live THRU/TODAY data
  useEffect(() => {
    if (!competition?.tournament?.id) return;
    supabase
      .from('tournaments')
      .select('sportsdata_id')
      .eq('id', competition.tournament.id)
      .single()
      .then(({ data }) => setSportsdataId(data?.sportsdata_id ?? null));
  }, [competition?.tournament?.id]);

  // Lazy draft auto-start: check on load whether scheduled time has passed
  useEffect(() => {
    if (!competition) return;
    if (competition.draft_status !== 'not_started') return;
    if (!competition.draft_scheduled_at) return;
    if (new Date(competition.draft_scheduled_at) > new Date()) return;
    maybeAutoStartDraft(competition).then((started) => {
      if (started) refetch();
    });
  }, [competition?.id, competition?.draft_status]);

  // Load tournament field count when admin panel is relevant
  const loadFieldCount = useCallback(async () => {
    if (!competition?.tournament?.id) return;
    const { count } = await supabase
      .from('tournament_golfers')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', competition.tournament.id)
      .eq('is_alternate', false);
    setFieldCount(count ?? 0);
  }, [competition?.tournament?.id]);

  useEffect(() => {
    if (isAdmin && competition?.draft_status === 'not_started') {
      loadFieldCount();
    }
  }, [isAdmin, competition?.draft_status, loadFieldCount]);

  const handleRefreshField = async () => {
    if (!competition?.tournament?.id) return;
    setFieldRefreshing(true);
    try {
      const { data: t } = await supabase
        .from('tournaments')
        .select('sportsdata_id')
        .eq('id', competition.tournament.id)
        .single();
      if (t?.sportsdata_id) {
        // Force a fresh sync by clearing last_updated logic — just call sync
        await syncTournamentField(competition.tournament.id, t.sportsdata_id);
      }
      await loadFieldCount();
    } finally {
      setFieldRefreshing(false);
    }
  };

  // Open draft order panel: load participants + previous standings
  const handleOpenDraftOrderPanel = async () => {
    if (!competition) return;
    setLoadingDraftOrder(true);
    setStartDraftError(null);
    setShowDraftOrderPanel(true);

    try {
      // 1. Fetch participants with profiles
      const { data: participants } = await supabase
        .from('competition_participants')
        .select('user_id')
        .eq('competition_id', competition.id);

      if (!participants || participants.length < 2) {
        setStartDraftError('Need at least 2 participants to start the draft.');
        setShowDraftOrderPanel(false);
        return;
      }

      const userIds = participants.map((p) => p.user_id);

      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, display_name, team_color')
        .in('id', userIds);

      const profileMap = new Map(
        (profiles ?? []).map((p) => [p.id, { name: p.display_name ?? 'Player', color: p.team_color ?? null }])
      );

      // 2. Try to find previous competition standings
      const prevCompId = await getPreviousCompetitionForParticipants(competition.id, userIds);
      let prevPositions = new Map<string, number>();

      if (prevCompId) {
        const leaderboard = await getCompetitionLeaderboard(prevCompId);
        leaderboard.forEach((entry) => {
          prevPositions.set(entry.userId, entry.finalPosition);
        });
      }

      // 3. Build ordered list
      // Snake draft: worst previous finisher picks first (highest position number = first in list)
      let entries: DraftOrderEntry[] = userIds.map((uid) => ({
        userId: uid,
        displayName: profileMap.get(uid)?.name ?? 'Player',
        teamColor: profileMap.get(uid)?.color ?? null,
        prevPositionLabel: prevPositions.has(uid)
          ? `Previous: ${ordinal(prevPositions.get(uid)!)}`
          : null,
      }));

      if (prevPositions.size > 0) {
        // Sort worst-to-best (highest position number first = picks first in snake draft)
        entries.sort((a, b) => {
          const posA = prevPositions.get(a.userId) ?? 0;
          const posB = prevPositions.get(b.userId) ?? 0;
          return posB - posA; // descending: worst finisher first
        });
      } else {
        entries = shuffle(entries);
      }

      setDraftOrderList(entries);
    } catch (e) {
      setStartDraftError(e instanceof Error ? e.message : 'Failed to load draft order');
      setShowDraftOrderPanel(false);
    } finally {
      setLoadingDraftOrder(false);
    }
  };

  const handleRandomize = () => {
    setDraftOrderList((prev) => shuffle(prev));
  };

  // Drag-and-drop handlers
  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    setDraftOrderList((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(index, 0, moved);
      return next;
    });
    setDragIndex(index);
  };
  const handleDragEnd = () => setDragIndex(null);

  const handleConfirmStartDraft = async () => {
    if (!competition || draftOrderList.length < 2) return;
    setStartingDraft(true);
    setStartDraftError(null);
    try {
      const orderEntries = draftOrderList.map((entry, i) => ({
        competition_id: competition.id,
        user_id: entry.userId,
        position: i + 1,
      }));

      const { error: orderError } = await supabase
        .from('draft_order')
        .insert(orderEntries);
      if (orderError) throw new Error(orderError.message);

      const { error: updateError } = await supabase
        .from('competitions')
        .update({ draft_status: 'in_progress', draft_started_at: new Date().toISOString() })
        .eq('id', competition.id);
      if (updateError) throw new Error(updateError.message);

      setShowDraftOrderPanel(false);
      await refetch();
    } catch (e) {
      setStartDraftError(e instanceof Error ? e.message : 'Failed to start draft');
    } finally {
      setStartingDraft(false);
    }
  };

  const handleJoin = async () => {
    if (!user || !competition) return;
    try {
      setJoining(true);
      setJoinError(null);
      await joinCompetition(competition.id, user.id);
      setIsUserParticipant(true);
      await refetch();
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Failed to join competition');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Loading competition…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-red-50 border border-red-100 px-5 py-4">
        <p className="text-sm text-red-700 font-medium">Error loading competition: {error.message}</p>
        <button onClick={() => refetch()} className="mt-2 text-sm text-red-600 hover:text-red-800 underline">
          Try again
        </button>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
        <p className="text-4xl mb-3">🏌️</p>
        <p className="font-semibold text-gray-700 mb-1">Competition not found</p>
        <Link to="/competitions" className="text-sm text-green-600 hover:text-green-700 font-medium">
          ← Back to competitions
        </Link>
      </div>
    );
  }

  const style = STATUS_STYLES[competition.draft_status] ?? STATUS_STYLES.not_started;
  const tournamentStatus = competition.tournament?.status;
  const draftOpen = competition.draft_status === 'not_started';
  const participantCount = competition.participantCount ?? 0;

  const draftScheduledLabel = competition.draft_scheduled_at
    ? new Date(competition.draft_scheduled_at).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
      })
    : null;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Back link */}
      <Link
        to="/competitions"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 font-medium transition-colors"
      >
        ← Back to competitions
      </Link>

      {/* Main card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className={`h-1 ${style.bar}`} />

        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start gap-3 mb-4">
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{competition.name}</h1>
            <span className={`shrink-0 px-3 py-1 text-xs font-semibold rounded-full border ${style.badge}`}>
              {style.label}
            </span>
          </div>

          {/* Tournament link */}
          {competition.tournament && (
            <div className="mb-4 pb-4 border-b border-gray-50">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Tournament</p>
              <div className="flex items-center gap-2">
                <Link
                  to={`/tournaments/${competition.tournament.id}`}
                  className="text-base font-semibold text-green-700 hover:text-green-600 transition-colors"
                >
                  ⛳ {competition.tournament.name}
                </Link>
                {tournamentStatus && (
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full border capitalize ${TOURNAMENT_STATUS_STYLES[tournamentStatus] ?? 'text-gray-500 bg-gray-100 border-gray-200'}`}>
                    {tournamentStatus}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Meta info */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500 mb-4">
            <span>
              <span className="font-medium text-gray-700">Participants:</span>{' '}
              {participantCount}
            </span>
            {draftScheduledLabel && draftOpen && (
              <span>
                <span className="font-medium text-gray-700">Draft starts:</span>{' '}
                {draftScheduledLabel}
              </span>
            )}
          </div>

          {/* Join button */}
          {user && !isUserParticipant && draftOpen && (
            <div className="mt-2">
              {joinError && (
                <div className="mb-3 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                  <p className="text-sm text-red-700">{joinError}</p>
                </div>
              )}
              <button
                onClick={handleJoin}
                disabled={joining}
                className="px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white font-semibold text-sm rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {joining ? 'Joining…' : 'Join Competition →'}
              </button>
            </div>
          )}

          {/* Already joined */}
          {isUserParticipant && draftOpen && (
            <p className="mt-2 text-sm text-green-600 font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              You're in — waiting for draft to start
            </p>
          )}

          {/* ── Admin panel ──────────────────────────────────────────── */}
          {isAdmin && draftOpen && (
            <div className="mt-5 pt-5 border-t border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Admin</p>

              {/* Tournament field status */}
              <div className="flex items-center gap-3 mb-4">
                {fieldCount === null ? (
                  <span className="text-sm text-gray-400">Checking field…</span>
                ) : fieldCount === 0 ? (
                  <span className="text-sm font-medium text-amber-600">⚠️ No player field loaded yet</span>
                ) : (
                  <span className="text-sm font-medium text-green-700">✓ {fieldCount} players in field</span>
                )}
                <button
                  onClick={handleRefreshField}
                  disabled={fieldRefreshing}
                  className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {fieldRefreshing ? 'Refreshing…' : 'Refresh Field'}
                </button>
              </div>

              {/* Error */}
              {startDraftError && (
                <p className="text-sm text-red-600 mb-3">{startDraftError}</p>
              )}

              {/* Set Draft Order button */}
              {!showDraftOrderPanel && (
                <button
                  onClick={handleOpenDraftOrderPanel}
                  disabled={participantCount < 2}
                  className="px-4 py-2 text-sm font-semibold border border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  ⚡ Set Draft Order
                </button>
              )}
              {participantCount < 2 && !showDraftOrderPanel && (
                <p className="mt-1 text-xs text-gray-400">Need at least 2 participants</p>
              )}

              {/* Draft order panel */}
              {showDraftOrderPanel && (
                <div className="mt-2 rounded-xl border border-orange-100 bg-orange-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-orange-900">Draft Order</p>
                      <p className="text-xs text-orange-700 mt-0.5">
                        Pick #1 drafts first. Drag to reorder.
                      </p>
                    </div>
                    <button
                      onClick={handleRandomize}
                      className="text-xs px-2.5 py-1 rounded-lg border border-orange-300 text-orange-700 hover:bg-orange-100 transition-colors"
                    >
                      🔀 Randomize
                    </button>
                  </div>

                  {loadingDraftOrder ? (
                    <p className="text-sm text-orange-700 py-2">Loading…</p>
                  ) : (
                    <ol className="space-y-1.5 mb-4">
                      {draftOrderList.map((entry, index) => {
                        const dotClass = entry.teamColor && entry.teamColor in COLOR_DOT_CLASSES
                          ? COLOR_DOT_CLASSES[entry.teamColor]
                          : 'bg-gray-300';
                        return (
                          <li
                            key={entry.userId}
                            draggable
                            onDragStart={() => handleDragStart(index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragEnd={handleDragEnd}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg bg-white border cursor-grab active:cursor-grabbing select-none transition-shadow ${
                              dragIndex === index ? 'shadow-md border-orange-300' : 'border-gray-100 hover:border-gray-200'
                            }`}
                          >
                            <span className="text-xs font-bold text-gray-400 w-5 shrink-0 text-center">
                              {index + 1}
                            </span>
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotClass}`} />
                            <span className="text-sm font-medium text-gray-900 flex-1">{entry.displayName}</span>
                            {entry.prevPositionLabel && (
                              <span className="text-xs text-gray-400 shrink-0">{entry.prevPositionLabel}</span>
                            )}
                            <span className="text-gray-300 text-sm shrink-0">⠿</span>
                          </li>
                        );
                      })}
                    </ol>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={handleConfirmStartDraft}
                      disabled={startingDraft || loadingDraftOrder || draftOrderList.length < 2}
                      className="px-4 py-2 text-sm font-semibold bg-orange-600 hover:bg-orange-500 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {startingDraft ? 'Starting…' : 'Confirm & Start Draft'}
                    </button>
                    <button
                      onClick={() => { setShowDraftOrderPanel(false); setStartDraftError(null); }}
                      disabled={startingDraft}
                      className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* ── End admin panel ──────────────────────────────────────── */}

          {/* Draft section for participants */}
          {isUserParticipant && (
            <DraftSection competition={competition} onUpdate={refetch} isParticipant={isUserParticipant} />
          )}

          {/* Admin toolkit (post-draft) */}
          {isAdmin && competition.draft_status === 'completed' && competition.tournament && user && (
            <AdminPanel
              competitionId={competition.id}
              tournamentId={competition.tournament.id}
              sportsdataId={sportsdataId}
              adminUserId={user.id}
              onDataChanged={refetch}
            />
          )}

          {/* Competition tabs after draft completes (visible to participants AND admins) */}
          {competition.draft_status === 'completed' && (isUserParticipant || isAdmin) && competition.tournament && (
            <CompetitionTabs
              competitionId={competition.id}
              tournamentId={competition.tournament.id}
              sportsdataId={sportsdataId}
              currentUserId={user?.id}
              tournamentStatus={tournamentStatus}
            />
          )}
        </div>
      </div>
    </div>
  );
}
