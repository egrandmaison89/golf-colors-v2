/**
 * TournamentDetail component
 * 
 * Displays detailed information about a single tournament
 */

import { useParams, Link } from 'react-router-dom';
import { useTournament } from '../hooks/useTournament';

export function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const { tournament, loading, error, refetch } = useTournament(id || '');

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
        <div className="text-sm text-red-800">
          Error loading tournament: {error.message}
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

  if (!tournament) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Tournament not found</p>
        <Link to="/tournaments" className="text-indigo-600 hover:text-indigo-800 mt-2 inline-block">
          Back to tournaments
        </Link>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const statusColors = {
    upcoming: 'bg-blue-100 text-blue-800',
    active: 'bg-green-100 text-green-800',
    completed: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        to="/tournaments"
        className="text-indigo-600 hover:text-indigo-800 mb-4 inline-block"
      >
        ← Back to tournaments
      </Link>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-3xl font-bold text-gray-900">{tournament.name}</h1>
          <span
            className={`px-3 py-1 text-sm font-medium rounded-full ${
              statusColors[tournament.status]
            }`}
          >
            {tournament.status}
          </span>
        </div>

        <div className="space-y-4">
          {tournament.course_name && (
            <div>
              <h3 className="text-sm font-medium text-gray-500">Course</h3>
              <p className="text-lg text-gray-900">{tournament.course_name}</p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-gray-500">Dates</h3>
            <p className="text-lg text-gray-900">
              {formatDate(tournament.start_date)} - {formatDate(tournament.end_date)}
            </p>
          </div>

          {tournament.purse && (
            <div>
              <h3 className="text-sm font-medium text-gray-500">Purse</h3>
              <p className="text-lg text-gray-900">
                ${tournament.purse.toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

