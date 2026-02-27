/**
 * AnnualLeaderboardPage component
 *
 * Displays year-over-year rankings for completed public competitions.
 * Columns: Rank | Player | Wins | Played | Winnings | Bounties | Total
 */

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAnnualLeaderboard } from '../hooks/useAnnualLeaderboard';

const CURRENT_YEAR = new Date().getFullYear();

const RANK_STYLES: Record<number, string> = {
  1: 'text-yellow-500',
  2: 'text-gray-400',
  3: 'text-amber-600',
};

const RANK_MEDALS: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

/** Format a net dollar amount: green "+$X.XX" or red "-$X.XX" */
function NetAmount({ value, className = '' }: { value: number; className?: string }) {
  const positive = value >= 0;
  return (
    <span className={`font-semibold ${positive ? 'text-green-600' : 'text-red-500'} ${className}`}>
      {positive ? '+' : '-'}${Math.abs(value).toFixed(2)}
    </span>
  );
}

export function AnnualLeaderboardPage() {
  const { user } = useAuth();
  const [year, setYear] = useState(CURRENT_YEAR);
  const { entries, loading, error } = useAnnualLeaderboard(year);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page header */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Annual Leaderboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Year-over-year rankings from completed public competitions.
          </p>
        </div>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-gray-700"
        >
          {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Loading rankings…</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-100 px-5 py-4">
          <p className="text-sm text-red-700 font-medium">{error.message}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && entries.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <p className="text-4xl mb-3">🏆</p>
          <p className="font-semibold text-gray-700 mb-1">No data yet for {year}</p>
          <p className="text-gray-400 text-sm">
            Rankings appear here automatically once public tournaments complete.
          </p>
        </div>
      )}

      {/* Leaderboard table */}
      {!loading && !error && entries.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Color bar */}
          <div className="h-1 flex">
            <div className="flex-1 bg-green-500" />
            <div className="flex-1 bg-red-500" />
            <div className="flex-1 bg-blue-500" />
            <div className="flex-1 bg-yellow-400" />
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Player
                  </th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Wins
                  </th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Played
                  </th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Winnings
                  </th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Bounties
                  </th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map((entry, i) => {
                  const rank = i + 1;
                  const isMe = entry.user_id === user?.id;
                  const total = entry.total_winnings + entry.total_bounties;
                  // Use team_color as a left-border accent if available
                  const accentStyle = entry.team_color
                    ? { borderLeft: `3px solid ${entry.team_color}` }
                    : {};

                  return (
                    <tr
                      key={entry.id}
                      style={accentStyle}
                      className={isMe ? 'bg-green-50' : 'hover:bg-gray-50 transition-colors'}
                    >
                      {/* Rank */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`text-sm font-bold ${RANK_STYLES[rank] ?? 'text-gray-400'}`}>
                          {RANK_MEDALS[rank] ?? rank}
                        </span>
                      </td>

                      {/* Player name */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`text-sm font-semibold ${isMe ? 'text-green-700' : 'text-gray-900'}`}>
                          {isMe
                            ? 'You ✦'
                            : (entry.display_name ?? 'Player')}
                        </span>
                      </td>

                      {/* Wins */}
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <span className="text-sm font-medium text-gray-900">
                          {entry.competitions_won}
                        </span>
                      </td>

                      {/* Played */}
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <span className="text-sm text-gray-500">
                          {entry.total_competitions}
                        </span>
                      </td>

                      {/* Winnings (main competition net) */}
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <NetAmount value={entry.total_winnings} className="text-sm" />
                      </td>

                      {/* Bounties (net bounty) */}
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <NetAmount value={entry.total_bounties} className="text-sm" />
                      </td>

                      {/* Total */}
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <NetAmount value={total} className="text-sm" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      {!loading && !error && entries.length > 0 && (
        <p className="text-xs text-gray-400 text-center">
          Winnings = net main competition ($1/stroke). Bounties = net bounty winnings.
          Total = Winnings + Bounties.
        </p>
      )}
    </div>
  );
}
