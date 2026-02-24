/**
 * TournamentCard — displays a single tournament in the list.
 */

import { Link } from 'react-router-dom';
import type { Tournament } from '../types';

interface TournamentCardProps {
  tournament: Tournament;
}

const STATUS_STYLES: Record<string, { badge: string; bar: string; label: string }> = {
  upcoming:  { badge: 'bg-blue-50 text-blue-700 border-blue-100',    bar: 'bg-blue-500',  label: 'Upcoming'  },
  active:    { badge: 'bg-green-50 text-green-700 border-green-100', bar: 'bg-green-500', label: 'Live Now'  },
  completed: { badge: 'bg-gray-100 text-gray-500 border-gray-200',   bar: 'bg-gray-300',  label: 'Completed' },
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

function formatPurse(purse: number) {
  if (purse >= 1_000_000) return `$${(purse / 1_000_000).toFixed(1)}M`;
  if (purse >= 1_000) return `$${(purse / 1_000).toFixed(0)}K`;
  return `$${purse}`;
}

export function TournamentCard({ tournament }: TournamentCardProps) {
  const style = STATUS_STYLES[tournament.status] ?? STATUS_STYLES.upcoming;

  return (
    <Link
      to={`/tournaments/${tournament.id}`}
      className="group block bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all overflow-hidden"
    >
      {/* Top color bar by status */}
      <div className={`h-1 ${style.bar}`} />

      <div className="p-5">
        <div className="flex justify-between items-start gap-2 mb-2">
          <h3 className="font-semibold text-gray-900 text-base leading-snug group-hover:text-green-700 transition-colors">
            {tournament.name}
          </h3>
          <span className={`shrink-0 px-2 py-0.5 text-xs font-semibold rounded-full border ${style.badge}`}>
            {style.label}
          </span>
        </div>

        {tournament.course_name && (
          <p className="text-sm text-gray-500 mb-3 flex items-center gap-1">
            <span>⛳</span> {tournament.course_name}
          </p>
        )}

        <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-50">
          <span>{formatDate(tournament.start_date)} – {formatDate(tournament.end_date)}</span>
          {tournament.purse && (
            <span className="font-medium text-gray-500">{formatPurse(tournament.purse)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
