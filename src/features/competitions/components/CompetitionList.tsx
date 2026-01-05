/**
 * CompetitionList component
 * 
 * Displays user's competitions
 */

import { useCompetitions } from '../hooks/useCompetitions';
import { CompetitionCard } from './CompetitionCard';
import { Link } from 'react-router-dom';

export function CompetitionList() {
  const { competitions, loading, error, refetch } = useCompetitions();

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-600">Loading competitions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="text-sm text-red-800">
          Error loading competitions: {error.message}
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

  if (competitions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">You haven't joined any competitions yet</p>
        <Link
          to="/tournaments"
          className="text-indigo-600 hover:text-indigo-800 underline"
        >
          Browse tournaments to create a competition
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">My Competitions</h2>
        <button
          onClick={() => refetch()}
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          Refresh
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

