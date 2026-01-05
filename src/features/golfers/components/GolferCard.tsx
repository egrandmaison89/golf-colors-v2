/**
 * GolferCard component
 * 
 * Displays a single golfer card
 */

import type { Golfer } from '../types';

interface GolferCardProps {
  golfer: Golfer;
  onClick?: () => void;
}

export function GolferCard({ golfer, onClick }: GolferCardProps) {
  const cardContent = (
    <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4">
      <div className="flex items-center space-x-4">
        {golfer.headshot_url ? (
          <img
            src={golfer.headshot_url}
            alt={golfer.display_name}
            className="w-16 h-16 rounded-full object-cover"
            onError={(e) => {
              // Hide image if it fails to load
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
            <span className="text-gray-400 text-xl">
              {golfer.first_name[0]}{golfer.last_name[0]}
            </span>
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">
            {golfer.display_name}
          </h3>
          {golfer.country && (
            <p className="text-sm text-gray-600">{golfer.country}</p>
          )}
          {golfer.world_ranking && (
            <p className="text-sm text-gray-500">
              World Ranking: #{golfer.world_ranking}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className="w-full text-left">
        {cardContent}
      </button>
    );
  }

  return cardContent;
}

