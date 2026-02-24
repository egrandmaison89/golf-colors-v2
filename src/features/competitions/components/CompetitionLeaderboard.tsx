/**
 * CompetitionLeaderboard component
 *
 * Displays competition leaderboard with scores (when tournament has results)
 */

import { useCompetitionLeaderboard } from '../hooks/useCompetitionLeaderboard';
import { BountyCard } from './BountyCard';

type TeamColor = 'yellow' | 'red' | 'green' | 'blue';

const COLOR_DOT: Record<TeamColor, string> = {
  yellow: 'bg-yellow-400',
  red: 'bg-red-500',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
};

function ColorDot({ color }: { color: string | null }) {
  if (!color || !(color in COLOR_DOT)) return null;
  return (
    <span
      className={`w-2.5 h-2.5 rounded-full shrink-0 ${COLOR_DOT[color as TeamColor]}`}
      title={`${color} team`}
    />
  );
}

interface CompetitionLeaderboardProps {
  competitionId: string;
  currentUserId: string | undefined;
  tournamentStatus?: string;
}

function ordinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

export function CompetitionLeaderboard({
  competitionId,
  currentUserId,
  tournamentStatus,
}: CompetitionLeaderboardProps) {
  const { leaderboard, loading, error } = useCompetitionLeaderboard(competitionId);

  if (loading) {
    return (
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Leaderboard</h3>
        <p className="text-sm text-gray-500">Loading scores...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Leaderboard</h3>
        <p className="text-sm text-red-600">{error.message}</p>
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Leaderboard</h3>
        <p className="text-sm text-gray-600">
          No scores yet. Tournament results will appear here once the tournament is underway.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 pt-6 border-t border-gray-200 space-y-6">
      <h3 className="text-lg font-medium text-gray-900">Leaderboard</h3>

      <div className="space-y-3">
        {leaderboard.map((entry) => {
          const isMe = entry.userId === currentUserId;
          const name = isMe ? 'You' : entry.displayName;

          return (
            <div
              key={entry.userId}
              className={`rounded-lg border p-4 ${
                isMe ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-gray-50'
              }`}
            >
              {/* Header row: position, name, total score */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="w-8 text-center font-bold text-gray-500 text-sm">
                    {ordinal(entry.finalPosition)}
                  </span>
                  <ColorDot color={entry.teamColor} />
                  <span className={`font-medium ${isMe ? 'text-indigo-700' : 'text-gray-900'}`}>
                    {name}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-semibold text-lg">
                    {entry.teamScoreToPar > 0 ? '+' : ''}{entry.teamScoreToPar}
                  </span>
                  <span className="text-xs text-gray-500 ml-1">to par</span>
                </div>
              </div>

              {/* Golfer breakdown */}
              <div className="ml-11 space-y-1">
                {entry.scoreBreakdown.map((g) => (
                  <div key={g.golferId} className="flex justify-between text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      {g.golferName}
                      {g.usedAlternate && (
                        <span className="text-xs text-amber-600 font-medium">(alt)</span>
                      )}
                      {g.missedCut && (
                        <span className="text-xs text-red-500">(MC)</span>
                      )}
                      {g.withdrew && !g.usedAlternate && (
                        <span className="text-xs text-gray-400">(WD)</span>
                      )}
                    </span>
                    <span className="font-mono">
                      {g.scoreToPar === null
                        ? '—'
                        : g.scoreToPar > 0
                        ? `+${g.scoreToPar}`
                        : `${g.scoreToPar}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bounty card - shown when tournament is completed */}
      {tournamentStatus === 'completed' && (
        <BountyCard competitionId={competitionId} leaderboard={leaderboard} />
      )}
    </div>
  );
}
