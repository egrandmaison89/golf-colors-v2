/**
 * CompetitionDetail component
 *
 * Displays detailed information about a competition.
 * - Checks lazy draft auto-start on every load (maybeAutoStartDraft)
 * - Admin users see a "Start Draft Now" override button
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
} from '../services/competitionService';
import { supabase } from '@/lib/supabase/client';
import { DraftSection } from './DraftSection';
import { CompetitionLeaderboard } from './CompetitionLeaderboard';
import { useState, useEffect } from 'react';

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

export function CompetitionDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { competition, loading, error, refetch } = useCompetition(id || '');
  const [isUserParticipant, setIsUserParticipant] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
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

  // Lazy draft auto-start: check on load whether scheduled time has passed
  useEffect(() => {
    if (!competition) return;
    if (competition.draft_status !== 'not_started') return;
    if (!competition.draft_scheduled_at) return;
    if (new Date(competition.draft_scheduled_at) > new Date()) return;

    // Time has passed — attempt to auto-start
    maybeAutoStartDraft(competition).then((started) => {
      if (started) refetch();
    });
  }, [competition?.id, competition?.draft_status]);

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

  /** Admin override: force-start draft immediately */
  const handleAdminStartDraft = async () => {
    if (!competition) return;
    setStartingDraft(true);
    setStartDraftError(null);
    try {
      // Fetch participants
      const { data: participants } = await supabase
        .from('competition_participants')
        .select('user_id')
        .eq('competition_id', competition.id);

      if (!participants || participants.length < 2) {
        setStartDraftError('Need at least 2 participants to start the draft.');
        return;
      }

      // Fisher-Yates shuffle
      const shuffled = [...participants];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const orderEntries = shuffled.map((p, i) => ({
        competition_id: competition.id,
        user_id: p.user_id,
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

      await refetch();
    } catch (e) {
      setStartDraftError(e instanceof Error ? e.message : 'Failed to start draft');
    } finally {
      setStartingDraft(false);
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
        <button
          onClick={() => refetch()}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
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
        {/* Status color bar */}
        <div className={`h-1 ${style.bar}`} />

        <div className="p-6">
          {/* Header row */}
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
              {competition.participantCount ?? 0}
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

          {/* Admin controls */}
          {isAdmin && draftOpen && (competition.participantCount ?? 0) >= 2 && (
            <div className="mt-5 pt-5 border-t border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Admin</p>
              {startDraftError && (
                <p className="text-sm text-red-600 mb-2">{startDraftError}</p>
              )}
              <button
                onClick={handleAdminStartDraft}
                disabled={startingDraft}
                className="px-4 py-2 text-sm font-semibold border border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-xl disabled:opacity-50 transition-colors"
              >
                {startingDraft ? 'Starting…' : '⚡ Start Draft Now'}
              </button>
            </div>
          )}

          {/* Draft section for participants */}
          {isUserParticipant && (
            <DraftSection competition={competition} onUpdate={refetch} />
          )}

          {/* Leaderboard after draft completes */}
          {competition.draft_status === 'completed' && isUserParticipant && (
            <CompetitionLeaderboard
              competitionId={competition.id}
              currentUserId={user?.id}
              tournamentStatus={tournamentStatus}
            />
          )}
        </div>
      </div>
    </div>
  );
}
