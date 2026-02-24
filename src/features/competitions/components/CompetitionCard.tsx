/**
 * CompetitionCard — displays a single competition in the dashboard list.
 */

import { Link } from 'react-router-dom';
import type { CompetitionWithDetails } from '../types';

interface CompetitionCardProps {
  competition: CompetitionWithDetails;
}

const STATUS_STYLES: Record<string, { badge: string; bar: string; label: string }> = {
  not_started: { badge: 'bg-gray-100 text-gray-500 border-gray-200',   bar: 'bg-gray-300',  label: 'Not Started' },
  in_progress:  { badge: 'bg-blue-50 text-blue-700 border-blue-100',    bar: 'bg-blue-500',  label: 'Draft Live'  },
  completed:    { badge: 'bg-green-50 text-green-700 border-green-100', bar: 'bg-green-500', label: 'Complete'    },
  canceled:     { badge: 'bg-red-50 text-red-600 border-red-100',       bar: 'bg-red-500',   label: 'Canceled'    },
};

export function CompetitionCard({ competition }: CompetitionCardProps) {
  const style = STATUS_STYLES[competition.draft_status] ?? STATUS_STYLES.not_started;
  const count = competition.participantCount ?? 0;

  return (
    <Link
      to={`/competitions/${competition.id}`}
      className="group block bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all overflow-hidden"
    >
      <div className={`h-1 ${style.bar}`} />

      <div className="p-5">
        <div className="flex justify-between items-start gap-2 mb-2">
          <h3 className="font-semibold text-gray-900 text-base leading-snug group-hover:text-green-700 transition-colors">
            {competition.name}
          </h3>
          <span className={`shrink-0 px-2 py-0.5 text-xs font-semibold rounded-full border ${style.badge}`}>
            {style.label}
          </span>
        </div>

        {competition.tournament && (
          <p className="text-sm text-gray-500 mb-3">⛳ {competition.tournament.name}</p>
        )}

        <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-50">
          <span>👥 {count} participant{count !== 1 ? 's' : ''}</span>
          {competition.draft_status === 'in_progress' && (
            <span className="flex items-center gap-1 text-blue-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Draft in progress
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
