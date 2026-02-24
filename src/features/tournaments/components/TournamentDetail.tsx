/**
 * TournamentDetail component
 *
 * Shows tournament info, the public competition card, and a "Create Private" button.
 */

import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTournament } from '../hooks/useTournament';
import { useAuth } from '@/contexts/AuthContext';
import {
  getOrCreatePublicCompetition,
  createPrivateCompetition,
  isParticipant,
  joinCompetition,
} from '@/features/competitions/services/competitionService';
import type { CompetitionWithDetails } from '@/features/competitions/types';

const SITE_URL = window.location.origin;

export function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { tournament, loading, error, refetch } = useTournament(id || '');

  const [publicComp, setPublicComp] = useState<CompetitionWithDetails | null>(null);
  const [publicCompLoading, setPublicCompLoading] = useState(false);
  const [isInPublic, setIsInPublic] = useState(false);
  const [joiningPublic, setJoiningPublic] = useState(false);

  const [creatingPrivate, setCreatingPrivate] = useState(false);
  const [privateName, setPrivateName] = useState('');
  const [showPrivateForm, setShowPrivateForm] = useState(false);
  const [newPrivateComp, setNewPrivateComp] = useState<CompetitionWithDetails | null>(null);
  const [privateError, setPrivateError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Load public competition once tournament is available
  useEffect(() => {
    if (!tournament || !user) return;
    setPublicCompLoading(true);
    getOrCreatePublicCompetition(tournament.id, tournament.name, tournament.start_date, user.id)
      .then(async (comp) => {
        setPublicComp(comp);
        const already = await isParticipant(comp.id, user.id);
        setIsInPublic(already);
      })
      .catch(console.error)
      .finally(() => setPublicCompLoading(false));
  }, [tournament?.id, user?.id]);

  const handleJoinPublic = async () => {
    if (!publicComp || !user) return;
    setJoiningPublic(true);
    try {
      await joinCompetition(publicComp.id, user.id);
      setIsInPublic(true);
      setPublicComp((prev) => prev ? { ...prev, participantCount: (prev.participantCount ?? 0) + 1 } : prev);
    } catch (e) {
      console.error(e);
    } finally {
      setJoiningPublic(false);
    }
  };

  const handleCreatePrivate = async () => {
    if (!tournament || !user || !privateName.trim()) return;
    setCreatingPrivate(true);
    setPrivateError(null);
    try {
      const comp = await createPrivateCompetition(
        tournament.id,
        privateName.trim(),
        user.id,
        tournament.start_date
      );
      setNewPrivateComp(comp);
      setShowPrivateForm(false);
      setPrivateName('');
    } catch (e) {
      setPrivateError(e instanceof Error ? e.message : 'Failed to create competition');
    } finally {
      setCreatingPrivate(false);
    }
  };

  const shareLink = newPrivateComp?.invite_code
    ? `${SITE_URL}/join/${newPrivateComp.invite_code}`
    : null;

  const handleCopy = async () => {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

  const statusColors = {
    upcoming: 'bg-blue-100 text-blue-800',
    active: 'bg-green-100 text-green-800',
    completed: 'bg-gray-100 text-gray-800',
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-600">Loading tournament...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="text-sm text-red-800">Error loading tournament: {error.message}</div>
        <button onClick={() => refetch()} className="mt-2 text-sm text-red-600 underline">Try again</button>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Tournament not found</p>
        <Link to="/tournaments" className="text-indigo-600 hover:text-indigo-800 mt-2 inline-block">← Back</Link>
      </div>
    );
  }

  const draftOpen = publicComp?.draft_status === 'not_started';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link to="/tournaments" className="text-indigo-600 hover:text-indigo-800 inline-block">
        ← Back to tournaments
      </Link>

      {/* Tournament info */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-3xl font-bold text-gray-900">{tournament.name}</h1>
          <span className={`px-3 py-1 text-sm font-medium rounded-full ${statusColors[tournament.status]}`}>
            {tournament.status}
          </span>
        </div>
        <div className="space-y-2 text-sm text-gray-600">
          {tournament.course_name && <p><span className="font-medium text-gray-700">Course:</span> {tournament.course_name}</p>}
          <p><span className="font-medium text-gray-700">Dates:</span> {formatDate(tournament.start_date)} – {formatDate(tournament.end_date)}</p>
          {tournament.purse && <p><span className="font-medium text-gray-700">Purse:</span> ${tournament.purse.toLocaleString()}</p>}
        </div>
      </div>

      {/* Public competition */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Public Competition</h2>
            <p className="text-sm text-gray-500">Open to everyone — no invite needed</p>
          </div>
          {publicComp && (
            <span className="text-sm text-gray-500">{publicComp.participantCount ?? 0} joined</span>
          )}
        </div>

        {publicCompLoading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : publicComp ? (
          <div className="flex flex-wrap gap-3 items-center">
            {isInPublic ? (
              <>
                <span className="text-sm text-green-600 font-medium">✓ You're in</span>
                <button
                  onClick={() => navigate(`/competitions/${publicComp.id}`)}
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  View Competition
                </button>
              </>
            ) : draftOpen ? (
              <button
                onClick={handleJoinPublic}
                disabled={joiningPublic}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {joiningPublic ? 'Joining...' : 'Join Public Competition'}
              </button>
            ) : (
              <div>
                <p className="text-sm text-gray-500">Draft has started — joining is closed.</p>
                <button
                  onClick={() => navigate(`/competitions/${publicComp.id}`)}
                  className="mt-2 text-sm text-indigo-600 hover:underline"
                >
                  Watch the leaderboard →
                </button>
              </div>
            )}
            {publicComp.draft_scheduled_at && draftOpen && (
              <p className="text-xs text-gray-400 w-full">
                Draft starts automatically {new Date(publicComp.draft_scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </p>
            )}
          </div>
        ) : null}
      </div>

      {/* Private competition */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Private Competition</h2>
            <p className="text-sm text-gray-500">Invite friends via a share link (expires in 72 hours)</p>
          </div>
          {!showPrivateForm && !newPrivateComp && (
            <button
              onClick={() => setShowPrivateForm(true)}
              className="px-4 py-2 text-sm bg-white border border-indigo-600 text-indigo-600 rounded-md hover:bg-indigo-50"
            >
              + Create Private
            </button>
          )}
        </div>

        {showPrivateForm && (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Competition name (e.g. The Boys)"
              value={privateName}
              onChange={(e) => setPrivateName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              onKeyDown={(e) => e.key === 'Enter' && handleCreatePrivate()}
            />
            {privateError && <p className="text-sm text-red-600">{privateError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleCreatePrivate}
                disabled={creatingPrivate || !privateName.trim()}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {creatingPrivate ? 'Creating...' : 'Create & Get Link'}
              </button>
              <button
                onClick={() => { setShowPrivateForm(false); setPrivateName(''); }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {newPrivateComp && shareLink && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-green-700">
              ✓ "{newPrivateComp.name}" created!
            </p>
            <div className="flex items-center gap-2 bg-gray-50 rounded-md border border-gray-200 px-3 py-2">
              <span className="text-sm text-gray-600 truncate flex-1">{shareLink}</span>
              <button
                onClick={handleCopy}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium shrink-0"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-gray-400">Link expires in 72 hours. Share it before the draft starts.</p>
            <button
              onClick={() => navigate(`/competitions/${newPrivateComp.id}`)}
              className="text-sm text-indigo-600 hover:underline"
            >
              Go to competition →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
