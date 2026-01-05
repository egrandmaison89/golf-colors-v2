/**
 * CompetitionDetail component
 * 
 * Displays detailed information about a competition
 */

import { useParams, Link } from 'react-router-dom';
import { useCompetition } from '../hooks/useCompetition';
import { useAuth } from '@/contexts/AuthContext';
import { joinCompetition, isParticipant } from '../services/competitionService';
import { useState, useEffect } from 'react';

export function CompetitionDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { competition, loading, error, refetch } = useCompetition(id || '');
  const [isUserParticipant, setIsUserParticipant] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Check if user is a participant
  useEffect(() => {
    if (competition && user) {
      isParticipant(competition.id, user.id).then(setIsUserParticipant);
    }
  }, [competition, user]);

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
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-600">Loading competition...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="text-sm text-red-800">
          Error loading competition: {error.message}
        </div>
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
      <div className="text-center py-12">
        <p className="text-gray-600">Competition not found</p>
        <Link to="/competitions" className="text-indigo-600 hover:text-indigo-800 mt-2 inline-block">
          Back to competitions
        </Link>
      </div>
    );
  }

  const statusColors = {
    not_started: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    canceled: 'bg-red-100 text-red-800',
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        to="/competitions"
        className="text-indigo-600 hover:text-indigo-800 mb-4 inline-block"
      >
        ← Back to competitions
      </Link>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-3xl font-bold text-gray-900">{competition.name}</h1>
          <span
            className={`px-3 py-1 text-sm font-medium rounded-full ${
              statusColors[competition.draft_status]
            }`}
          >
            {competition.draft_status.replace('_', ' ')}
          </span>
        </div>

        {competition.tournament && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-500">Tournament</h3>
            <Link
              to={`/tournaments/${competition.tournament.id}`}
              className="text-lg text-indigo-600 hover:text-indigo-800"
            >
              {competition.tournament.name}
            </Link>
          </div>
        )}

        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-500">Participants</h3>
          <p className="text-lg text-gray-900">
            {competition.participantCount || 0} participants
          </p>
        </div>

        {user && !isUserParticipant && competition.draft_status === 'not_started' && (
          <div className="mt-6">
            {joinError && (
              <div className="mb-4 rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-800">{joinError}</div>
              </div>
            )}
            <button
              onClick={handleJoin}
              disabled={joining}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {joining ? 'Joining...' : 'Join Competition'}
            </button>
          </div>
        )}

        {isUserParticipant && (
          <div className="mt-6">
            <p className="text-sm text-gray-600">You are a participant in this competition</p>
          </div>
        )}
      </div>
    </div>
  );
}

