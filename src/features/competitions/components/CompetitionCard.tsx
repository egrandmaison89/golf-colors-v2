/**
 * CompetitionCard component
 * 
 * Displays a single competition card
 */

import { Link } from 'react-router-dom';
import type { CompetitionWithDetails } from '../types';

interface CompetitionCardProps {
  competition: CompetitionWithDetails;
}

export function CompetitionCard({ competition }: CompetitionCardProps) {
  const statusColors = {
    not_started: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    canceled: 'bg-red-100 text-red-800',
  };

  return (
    <Link
      to={`/competitions/${competition.id}`}
      className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-lg font-semibold text-gray-900">
          {competition.name}
        </h3>
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            statusColors[competition.draft_status]
          }`}
        >
          {competition.draft_status.replace('_', ' ')}
        </span>
      </div>

      {competition.tournament && (
        <p className="text-sm text-gray-600 mb-2">
          {competition.tournament.name}
        </p>
      )}

      <div className="text-sm text-gray-500">
        <p>{competition.participantCount || 0} participants</p>
      </div>
    </Link>
  );
}

