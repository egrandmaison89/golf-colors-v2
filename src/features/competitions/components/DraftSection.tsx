/**
 * DraftSection component
 *
 * Renders draft UI based on competition status: in-progress draft picks, completed teams,
 * and alternate selection. Includes:
 *  - Tournament-specific player field (from /Leaderboard endpoint, not all-players)
 *  - Sorting by odds (favorites first) or alphabetical
 *  - Prominent "your turn" banner when it's the user's pick
 *  - 10-second polling while draft is live
 */

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDraftOrder } from '../hooks/useDraftOrder';
import { useDraftPicks } from '../hooks/useDraftPicks';
import { useStartDraft } from '../hooks/useStartDraft';
import { useMakePick } from '../hooks/useMakePick';
import { useSelectAlternate } from '../hooks/useSelectAlternate';
import { useCurrentTurn } from '../hooks/useCurrentTurn';
import { getAlternates } from '../services/draftService';
import { syncTournamentField, getTournamentField } from '@/features/golfers/services/golferService';
import { supabase } from '@/lib/supabase/client';
import type { CompetitionWithDetails } from '../types';
import type { TournamentGolferEntry } from '@/features/golfers/services/golferService';

type SortMode = 'odds' | 'alpha';
type TeamColor = 'yellow' | 'red' | 'green' | 'blue';

const COLOR_DOT: Record<TeamColor, string> = {
  yellow: 'bg-yellow-400',
  red: 'bg-red-500',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
};

function ColorDot({ color }: { color: string | null | undefined }) {
  if (!color || !(color in COLOR_DOT)) return null;
  return (
    <span className={`w-2.5 h-2.5 rounded-full shrink-0 inline-block ${COLOR_DOT[color as TeamColor]}`} />
  );
}

interface DraftSectionProps {
  competition: CompetitionWithDetails;
  onUpdate: () => void;
  isParticipant: boolean;
}

interface UserProfile {
  name: string;
  color: string | null;
}

async function fetchUserProfiles(userIds: string[]): Promise<Map<string, UserProfile>> {
  if (userIds.length === 0) return new Map();
  const { data } = await supabase
    .from('user_profiles')
    .select('id, display_name, team_color')
    .in('id', userIds);
  const map = new Map<string, UserProfile>();
  for (const row of data ?? []) {
    map.set(row.id, { name: row.display_name ?? 'Player', color: row.team_color ?? null });
  }
  return map;
}

function formatOdds(odds: number | null): string {
  if (odds === null) return '';
  const numerator = Math.round(odds - 1);
  return `${numerator}/1`;
}

export function DraftSection({ competition, onUpdate, isParticipant }: DraftSectionProps) {
  const { user } = useAuth();
  const isCreator = user?.id === competition.created_by;

  const { start, loading: startLoading, error: startError } = useStartDraft();
  const { pick, loading: pickLoading, error: pickError } = useMakePick();
  const { select, loading: alternateLoading, error: alternateError } = useSelectAlternate();

  const { draftOrder, loading: orderLoading, refetch: refetchOrder } = useDraftOrder(competition.id);
  const { draftPicks, loading: picksLoading, refetch: refetchPicks } = useDraftPicks(competition.id);
  const { currentTurnUserId, pickNumber, refetch: refetchTurn } = useCurrentTurn(competition.id);

  const [alternates, setAlternates] = useState<{ user_id: string; golfer_id: string }[]>([]);
  const [golferSearch, setGolferSearch] = useState('');
  const [alternateSearch, setAlternateSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('odds');
  const [userProfiles, setUserProfilesMap] = useState<Map<string, UserProfile>>(new Map());

  const [fieldGolfers, setFieldGolfers] = useState<TournamentGolferEntry[]>([]);
  const [fieldLoading, setFieldLoading] = useState(false);
  const [fieldSynced, setFieldSynced] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync and load tournament field
  useEffect(() => {
    const tournament = competition.tournament;
    if (!tournament) return;
    if (competition.draft_status === 'canceled') return;
    loadTournamentField(tournament.id);
  }, [competition.tournament?.id]);

  async function loadTournamentField(tournamentId: string) {
    setFieldLoading(true);
    try {
      const { data: t } = await supabase
        .from('tournaments')
        .select('sportsdata_id')
        .eq('id', tournamentId)
        .single();

      if (t?.sportsdata_id) {
        await syncTournamentField(tournamentId, t.sportsdata_id);
        setFieldSynced(true);
      }

      const field = await getTournamentField(tournamentId);
      setFieldGolfers(field);
    } catch (e) {
      console.error('Failed to load tournament field:', e);
      setFieldError('Failed to load tournament field. Please refresh the page.');
    } finally {
      setFieldLoading(false);
    }
  }

  useEffect(() => {
    const userIds = draftOrder.map((o) => o.user_id);
    if (userIds.length > 0) {
      fetchUserProfiles(userIds).then(setUserProfilesMap);
    }
  }, [draftOrder]);

  useEffect(() => {
    if (competition.draft_status === 'completed') {
      getAlternates(competition.id).then((data) => {
        setAlternates(data.map((a) => ({ user_id: a.user_id, golfer_id: a.golfer_id })));
      });
    }
  }, [competition.id, competition.draft_status]);

  useEffect(() => {
    if (competition.draft_status !== 'in_progress') {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    pollingRef.current = setInterval(async () => {
      await Promise.all([refetchPicks(), refetchTurn()]);
    }, 10000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [competition.draft_status]);

  const refetchAll = async () => {
    await Promise.all([refetchOrder(), refetchPicks(), refetchTurn()]);
    if (competition.draft_status === 'completed') {
      const alts = await getAlternates(competition.id);
      setAlternates(alts.map((a) => ({ user_id: a.user_id, golfer_id: a.golfer_id })));
    }
    onUpdate();
  };

  const handleStartDraft = async () => {
    try {
      await start(competition.id);
      await refetchAll();
    } catch { /* error set in hook */ }
  };

  const handleMakePick = async (golferId: string) => {
    try {
      await pick(competition.id, golferId);
      setGolferSearch('');
      await refetchAll();
    } catch { /* error set in hook */ }
  };

  const handleSelectAlternate = async (golferId: string) => {
    try {
      await select(competition.id, golferId);
      await refetchAll();
      setAlternates((prev) => [...prev, { user_id: user!.id, golfer_id: golferId }]);
    } catch { /* error set in hook */ }
  };

  const getName = (userId: string) => {
    if (userId === user?.id) return 'You';
    return userProfiles.get(userId)?.name ?? 'Player';
  };

  const getColor = (userId: string): string | null => {
    return userProfiles.get(userId)?.color ?? null;
  };

  const pickedGolferIds = new Set(draftPicks.map((p) => p.golfer_id));

  const sortField = (list: TournamentGolferEntry[]) =>
    [...list].sort((a, b) =>
      sortMode === 'alpha'
        ? a.display_name.localeCompare(b.display_name)
        : (a.odds_to_win ?? Infinity) - (b.odds_to_win ?? Infinity)
    );

  const availableField = fieldGolfers.filter((g) => !pickedGolferIds.has(g.golfer_id));
  const sortedAvailable = sortField(availableField);
  const filteredAvailable = golferSearch
    ? sortedAvailable.filter((g) => g.display_name.toLowerCase().includes(golferSearch.toLowerCase()))
    : sortedAvailable;

  const alternatePool = sortField(fieldGolfers.filter((g) => !pickedGolferIds.has(g.golfer_id)));
  const filteredAlternates = alternateSearch
    ? alternatePool.filter((g) => g.display_name.toLowerCase().includes(alternateSearch.toLowerCase()))
    : alternatePool;

  const isUserTurn = !!(user && currentTurnUserId === user.id);
  const userHasAlternate = alternates.some((a) => a.user_id === user?.id);
  const totalPicks = draftOrder.length * 3;
  const draftComplete = draftPicks.length >= totalPicks;

  // ── not_started ──────────────────────────────────────────────
  if (competition.draft_status === 'not_started') {
    return (
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Draft</h3>
        <p className="text-sm text-gray-600 mb-4">
          Each participant picks 3 golfers in a snake draft format.
        </p>
        {isCreator && (
          <>
            {startError && (
              <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{startError.message}</div>
            )}
            <button
              onClick={handleStartDraft}
              disabled={startLoading || (competition.participantCount ?? 0) < 2}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {startLoading ? 'Starting...' : 'Start Draft'}
            </button>
            {(competition.participantCount ?? 0) < 2 && (
              <p className="mt-2 text-sm text-gray-500">Need at least 2 participants to start</p>
            )}
          </>
        )}
        {!isCreator && (
          <p className="text-sm text-gray-500">Waiting for the draft to start.</p>
        )}
      </div>
    );
  }

  // ── in_progress ──────────────────────────────────────────────
  if (competition.draft_status === 'in_progress') {
    return (
      <div className="mt-6 pt-6 border-t border-gray-200 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Draft in Progress</h3>
          <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live
          </span>
        </div>

        {/* YOUR TURN — prominent banner */}
        {isUserTurn && !draftComplete && (
          <div className="rounded-lg bg-indigo-600 text-white px-4 py-3 flex items-center gap-3 shadow">
            <span className="text-2xl">🏌️</span>
            <div>
              <p className="font-bold text-base leading-tight">It's your turn!</p>
              <p className="text-indigo-200 text-sm">Pick #{pickNumber} — choose a golfer below</p>
            </div>
          </div>
        )}

        {/* Waiting banner */}
        {!isUserTurn && !draftComplete && (
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 flex items-center gap-3">
            <span className="text-lg">⏳</span>
            <p className="text-sm text-gray-600">
              Waiting for <strong>{getName(currentTurnUserId ?? '')}</strong> (Pick #{pickNumber})
              <span className="ml-2 text-gray-400 text-xs">· auto-refreshing</span>
            </p>
          </div>
        )}

        {/* Draft order */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Draft Order</h4>
          <div className="flex flex-wrap gap-2">
            {draftOrder.map((entry, i) => {
              const isTurn = entry.user_id === currentTurnUserId;
              const isMe = entry.user_id === user?.id;
              return (
                <span
                  key={entry.id}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${
                    isTurn
                      ? 'bg-indigo-600 text-white ring-2 ring-indigo-300'
                      : isMe
                      ? 'bg-indigo-100 text-indigo-800'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <ColorDot color={getColor(entry.user_id)} />
                  {i + 1}. {getName(entry.user_id)}{isTurn ? ' ←' : ''}
                </span>
              );
            })}
          </div>
        </div>

        {/* Picks so far */}
        {draftPicks.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Picks ({draftPicks.length}/{totalPicks})
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {draftPicks.map((p) => (
                <div
                  key={p.id}
                  className={`text-sm rounded p-2 flex justify-between items-center ${
                    p.user_id === user?.id ? 'bg-indigo-50 border border-indigo-100' : 'bg-gray-50'
                  }`}
                >
                  <span>
                    <span className="font-medium text-gray-400 mr-1">#{p.pick_number}</span>
                    {p.golfer?.display_name ?? 'Unknown'}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-xs ml-1 ${p.user_id === user?.id ? 'text-indigo-500 font-medium' : 'text-gray-400'}`}>
                    <ColorDot color={getColor(p.user_id)} />
                    {getName(p.user_id)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pick interface */}
        {isUserTurn && !draftComplete && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700">
                Select a golfer
                {filteredAvailable.length > 0 && (
                  <span className="ml-2 text-gray-400 font-normal">({filteredAvailable.length} available)</span>
                )}
              </h4>
              <div className="flex gap-1 text-xs">
                <button
                  onClick={() => setSortMode('odds')}
                  className={`px-2 py-1 rounded ${sortMode === 'odds' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  By Odds
                </button>
                <button
                  onClick={() => setSortMode('alpha')}
                  className={`px-2 py-1 rounded ${sortMode === 'alpha' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  A–Z
                </button>
              </div>
            </div>

            {pickError && (
              <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-800">{pickError.message}</div>
            )}

            <input
              type="text"
              placeholder="Search by name..."
              value={golferSearch}
              onChange={(e) => setGolferSearch(e.target.value)}
              className="mb-3 w-full sm:w-72 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            {fieldLoading ? (
              <p className="text-gray-500 text-sm">Loading tournament field…</p>
            ) : !fieldSynced && fieldGolfers.length === 0 ? (
              <p className="text-gray-400 text-sm">Field not yet available.</p>
            ) : filteredAvailable.length === 0 ? (
              <p className="text-gray-500 text-sm">
                {golferSearch ? `No golfers match "${golferSearch}"` : 'No golfers available.'}
              </p>
            ) : (
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                {filteredAvailable.map((golfer) => (
                  <button
                    key={golfer.golfer_id}
                    onClick={() => handleMakePick(golfer.golfer_id)}
                    disabled={pickLoading}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-indigo-50 disabled:opacity-50 text-left transition-colors"
                  >
                    <span className="font-medium text-gray-900 text-sm">{golfer.display_name}</span>
                    {golfer.odds_to_win !== null && (
                      <span className="text-xs text-gray-400 ml-4 shrink-0">{formatOdds(golfer.odds_to_win)} odds</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {(orderLoading || picksLoading) && (
          <p className="text-sm text-gray-500">Loading draft…</p>
        )}
      </div>
    );
  }

  // ── completed ────────────────────────────────────────────────
  if (competition.draft_status === 'completed') {
    return (
      <div className="mt-6 pt-6 border-t border-gray-200 space-y-6">
        <h3 className="text-lg font-medium text-gray-900">Draft Complete</h3>

        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Teams</h4>
          <div className="space-y-2">
            {draftOrder.map((entry) => {
              const userPicks = draftPicks
                .filter((p) => p.user_id === entry.user_id)
                .sort((a, b) => a.pick_number - b.pick_number);
              const alt = alternates.find((a) => a.user_id === entry.user_id);
              const altGolfer = alt ? fieldGolfers.find((g) => g.golfer_id === alt.golfer_id) : null;
              const isMe = entry.user_id === user?.id;

              return (
                <div
                  key={entry.id}
                  className={`text-sm rounded-lg p-3 ${isMe ? 'bg-indigo-50 border border-indigo-100' : 'bg-gray-50'}`}
                >
                  <span className={`inline-flex items-center gap-1.5 font-semibold ${isMe ? 'text-indigo-800' : 'text-gray-700'}`}>
                    <ColorDot color={getColor(entry.user_id)} />
                    {getName(entry.user_id)}:
                  </span>{' '}
                  <span className="text-gray-700">
                    {userPicks.map((p) => p.golfer?.display_name).join(', ') || '—'}
                  </span>
                  {altGolfer && (
                    <span className="ml-2 text-xs text-amber-600">(alt: {altGolfer.display_name})</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {isParticipant && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Alternate (Optional)</h4>
            <p className="text-sm text-gray-600 mb-3">Choose an alternate in case one of your picks withdraws.</p>
            {userHasAlternate ? (
              <p className="text-sm text-green-600 font-medium">✓ Alternate selected</p>
            ) : (
              <>
                {alternateError && (
                  <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-800">{alternateError.message}</div>
                )}
                {fieldError && (
                  <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-800">{fieldError}</div>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="Search golfers..."
                    value={alternateSearch}
                    onChange={(e) => setAlternateSearch(e.target.value)}
                    className="w-full sm:w-64 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex gap-1 text-xs shrink-0">
                    <button
                      onClick={() => setSortMode('odds')}
                      className={`px-2 py-1 rounded ${sortMode === 'odds' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                    >
                      Odds
                    </button>
                    <button
                      onClick={() => setSortMode('alpha')}
                      className={`px-2 py-1 rounded ${sortMode === 'alpha' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                    >
                      A–Z
                    </button>
                  </div>
                </div>

                {fieldLoading ? (
                  <p className="text-gray-500 text-sm">Loading…</p>
                ) : filteredAlternates.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    {alternateSearch ? `No golfers match "${alternateSearch}"` : 'No golfers available.'}
                  </p>
                ) : (
                  <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                    {filteredAlternates.map((golfer) => (
                      <button
                        key={golfer.golfer_id}
                        onClick={() => handleSelectAlternate(golfer.golfer_id)}
                        disabled={alternateLoading}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-indigo-50 disabled:opacity-50 text-left transition-colors"
                      >
                        <span className="font-medium text-gray-900 text-sm">{golfer.display_name}</span>
                        {golfer.odds_to_win !== null && (
                          <span className="text-xs text-gray-400 ml-4 shrink-0">{formatOdds(golfer.odds_to_win)} odds</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
}
