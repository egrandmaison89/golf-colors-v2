/**
 * JoinPage component — /join/:inviteCode
 *
 * Handles invite-link flow for private competitions:
 *  1. If not logged in → save code to sessionStorage, redirect to /login
 *  2. If logged in → validate code, join competition, redirect to /competitions/:id
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  getCompetitionByInviteCode,
  joinCompetition,
  isParticipant,
} from '../services/competitionService';
import type { CompetitionWithDetails } from '../types';

const INVITE_CODE_KEY = 'pendingInviteCode';

export function JoinPage() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [competition, setCompetition] = useState<CompetitionWithDetails | null>(null);
  const [status, setStatus] = useState<
    'loading' | 'not_found' | 'expired' | 'draft_started' | 'already_joined' | 'ready' | 'joining' | 'joined' | 'error'
  >('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Step 1: Auth guard — save code and redirect to login if not authenticated
  useEffect(() => {
    if (authLoading) return;
    if (!user && inviteCode) {
      sessionStorage.setItem(INVITE_CODE_KEY, inviteCode);
      navigate('/login', { replace: true });
    }
  }, [authLoading, user, inviteCode, navigate]);

  // Step 2: After login, check for pending invite code and redirect back here
  // (This is handled in LoginPage — it reads INVITE_CODE_KEY after login and navigates to /join/:code)

  // Step 3: Validate the invite code and check membership
  useEffect(() => {
    if (authLoading || !user || !inviteCode) return;

    // Clear any pending invite code now that we're authenticated
    sessionStorage.removeItem(INVITE_CODE_KEY);

    let cancelled = false;

    async function validate() {
      setStatus('loading');
      try {
        const comp = await getCompetitionByInviteCode(inviteCode!);

        if (cancelled) return;

        if (!comp) {
          setStatus('not_found');
          return;
        }

        // Check if invite is expired
        if (comp.invite_expires_at && new Date(comp.invite_expires_at) < new Date()) {
          setStatus('expired');
          return;
        }

        // Check if draft has started
        if (comp.draft_status !== 'not_started') {
          setCompetition(comp);
          setStatus('draft_started');
          return;
        }

        // Check if already a participant
        const already = await isParticipant(comp.id, user!.id);
        if (cancelled) return;

        if (already) {
          setCompetition(comp);
          setStatus('already_joined');
          return;
        }

        setCompetition(comp);
        setStatus('ready');
      } catch (e) {
        if (!cancelled) {
          setErrorMsg(e instanceof Error ? e.message : 'Something went wrong');
          setStatus('error');
        }
      }
    }

    validate();
    return () => { cancelled = true; };
  }, [authLoading, user, inviteCode]);

  const handleJoin = async () => {
    if (!competition || !user) return;
    setStatus('joining');
    try {
      await joinCompetition(competition.id, user.id);
      setStatus('joined');
      // Redirect after brief success moment
      setTimeout(() => navigate(`/competitions/${competition.id}`), 1200);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to join');
      setStatus('error');
    }
  };

  // While auth is loading or waiting for redirect
  if (authLoading || (!user && status === 'loading')) {
    return <PageShell><p className="text-gray-500">Checking your session…</p></PageShell>;
  }

  if (status === 'loading') {
    return <PageShell><p className="text-gray-500">Validating invite link…</p></PageShell>;
  }

  if (status === 'not_found') {
    return (
      <PageShell>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Link not found</h2>
        <p className="text-gray-500 mb-4">
          This invite link doesn't exist or may have already been used.
        </p>
        <Link to="/tournaments" className="text-indigo-600 hover:underline">
          Browse tournaments →
        </Link>
      </PageShell>
    );
  }

  if (status === 'expired') {
    return (
      <PageShell>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Link expired</h2>
        <p className="text-gray-500 mb-4">
          This invite link expired 72 hours after it was created. Ask the competition
          creator to send you a fresh link.
        </p>
        <Link to="/tournaments" className="text-indigo-600 hover:underline">
          Browse tournaments →
        </Link>
      </PageShell>
    );
  }

  if (status === 'draft_started') {
    return (
      <PageShell>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Draft already started</h2>
        <p className="text-gray-500 mb-4">
          <strong>{competition?.name}</strong> has already begun its draft.
          New participants can't join after the draft starts.
        </p>
        <button
          onClick={() => navigate(`/competitions/${competition!.id}`)}
          className="text-indigo-600 hover:underline"
        >
          Watch the leaderboard →
        </button>
      </PageShell>
    );
  }

  if (status === 'already_joined') {
    return (
      <PageShell>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">You're already in!</h2>
        <p className="text-gray-500 mb-4">
          You're already a participant in <strong>{competition?.name}</strong>.
        </p>
        <button
          onClick={() => navigate(`/competitions/${competition!.id}`)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
        >
          Go to competition →
        </button>
      </PageShell>
    );
  }

  if (status === 'joined') {
    return (
      <PageShell>
        <div className="text-green-600 text-4xl mb-3">✓</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">You're in!</h2>
        <p className="text-gray-500">Redirecting to <strong>{competition?.name}</strong>…</p>
      </PageShell>
    );
  }

  if (status === 'error') {
    return (
      <PageShell>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-red-600 text-sm mb-4">{errorMsg}</p>
        <Link to="/tournaments" className="text-indigo-600 hover:underline">
          Browse tournaments →
        </Link>
      </PageShell>
    );
  }

  // status === 'ready' — show join prompt
  const tournamentName = competition?.tournament?.name ?? 'a tournament';
  const draftDate = competition?.draft_scheduled_at
    ? new Date(competition.draft_scheduled_at).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
      })
    : null;

  return (
    <PageShell>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">You've been invited!</h2>
      <p className="text-gray-500 mb-6 text-sm">
        Join <strong>{competition?.name}</strong> for {tournamentName}.
      </p>

      <div className="bg-gray-50 rounded-md border border-gray-200 p-4 mb-6 text-sm space-y-1">
        <p><span className="font-medium text-gray-700">Competition:</span> {competition?.name}</p>
        <p><span className="font-medium text-gray-700">Tournament:</span> {tournamentName}</p>
        <p><span className="font-medium text-gray-700">Participants:</span> {competition?.participantCount ?? 0} so far</p>
        {draftDate && (
          <p><span className="font-medium text-gray-700">Draft starts:</span> {draftDate}</p>
        )}
      </div>

      <button
        onClick={handleJoin}
        disabled={status === 'joining'}
        className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 font-medium"
      >
        {status === 'joining' ? 'Joining…' : 'Join Competition'}
      </button>
    </PageShell>
  );
}

/** Centered card wrapper shared across all states */
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="bg-white rounded-lg shadow p-8 max-w-md w-full text-center">
        {children}
      </div>
    </div>
  );
}
