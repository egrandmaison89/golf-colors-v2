/**
 * TournamentCard component
 * 
 * Displays a single tournament card
 */

import { Link } from 'react-router-dom';
import type { Tournament } from '../types';

interface TournamentCardProps {
  tournament: Tournament;
}

export function TournamentCard({ tournament }: TournamentCardProps) {
  const statusColors = {
    upcoming: 'bg-blue-100 text-blue-800',
    active: 'bg-green-100 text-green-800',
    completed: 'bg-gray-100 text-gray-800',
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Link
      to={`/tournaments/${tournament.id}`}
      className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-lg font-semibold text-gray-900">
          {tournament.name}
        </h3>
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            statusColors[tournament.status]
          }`}
        >
          {tournament.status}
        </span>
      </div>

      {tournament.course_name && (
        <p className="text-sm text-gray-600 mb-2">{tournament.course_name}</p>
      )}

      <div className="text-sm text-gray-500">
        <p>
          {formatDate(tournament.start_date)} - {formatDate(tournament.end_date)}
        </p>
        {tournament.purse && (
          <p className="mt-1">Purse: ${tournament.purse.toLocaleString()}</p>
        )}
      </div>
    </Link>
  );
}

