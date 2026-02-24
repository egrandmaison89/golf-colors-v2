/**
 * TournamentList — displays the full PGA Tour schedule.
 */

import { useTournaments } from '../hooks/useTournaments';
import { TournamentCard } from './TournamentCard';

export function TournamentList() {
  const { tournaments, loading, error, refetch } = useTournaments();

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tournaments</h1>
          <p className="text-gray-500 text-sm mt-0.5">PGA Tour schedule — create a competition for any event.</p>
        </div>
        <button
          onClick={() => refetch(true)}
          className="text-xs font-medium text-gray-500 hover:text-gray-900 border border-gray-200 hover:border-gray-400 px-3 py-1.5 rounded-lg transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Loading tournaments…</p>
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-100 px-5 py-4">
          <p className="text-sm text-red-700 font-medium">{error.message}</p>
          <button onClick={() => refetch(true)} className="mt-2 text-sm text-red-600 hover:text-red-800 underline">
            Try again
          </button>
        </div>
      )}

      {!loading && !error && tournaments.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <p className="text-4xl mb-3">⛳</p>
          <p className="font-medium text-gray-600">No tournaments found</p>
          <p className="text-sm text-gray-400 mt-1">Click Refresh to sync from the API.</p>
        </div>
      )}

      {!loading && !error && tournaments.length > 0 && (
        <>
          {tournaments.some((t) => t.status === 'active') && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-green-600 mb-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Live Now
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tournaments.filter((t) => t.status === 'active').map((t) => (
                  <TournamentCard key={t.id} tournament={t} />
                ))}
              </div>
            </div>
          )}

          {tournaments.some((t) => t.status === 'upcoming') && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">Upcoming</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tournaments.filter((t) => t.status === 'upcoming').map((t) => (
                  <TournamentCard key={t.id} tournament={t} />
                ))}
              </div>
            </div>
          )}

          {tournaments.some((t) => t.status === 'completed') && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Completed</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tournaments.filter((t) => t.status === 'completed').map((t) => (
                  <TournamentCard key={t.id} tournament={t} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
