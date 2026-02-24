/**
 * CompetitionList — shows user's competitions on the dashboard.
 */

import { useCompetitions } from '../hooks/useCompetitions';
import { CompetitionCard } from './CompetitionCard';
import { Link } from 'react-router-dom';

export function CompetitionList() {
  const { competitions, loading, error, refetch } = useCompetitions();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Loading competitions…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-red-50 border border-red-100 px-5 py-4">
        <p className="text-sm text-red-700 font-medium">{error.message}</p>
        <button onClick={() => refetch()} className="mt-2 text-sm text-red-600 hover:text-red-800 underline">
          Try again
        </button>
      </div>
    );
  }

  if (competitions.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
        <p className="text-4xl mb-3">🏌️</p>
        <p className="font-semibold text-gray-700 mb-1">No competitions yet</p>
        <p className="text-gray-400 text-sm mb-5">Browse tournaments to create or join a competition.</p>
        <Link
          to="/tournaments"
          className="inline-flex items-center gap-1 px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl text-sm transition-colors"
        >
          Browse Tournaments →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-900">My Competitions</h2>
        <button
          onClick={() => refetch()}
          className="text-xs font-medium text-gray-500 hover:text-gray-900 border border-gray-200 hover:border-gray-400 px-3 py-1.5 rounded-lg transition-colors"
        >
          ↻ Refresh
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {competitions.map((competition) => (
          <CompetitionCard key={competition.id} competition={competition} />
        ))}
      </div>
    </div>
  );
}
