/**
 * CreateCompetitionForm component
 *
 * Form to create a new competition for a tournament.
 * Used on the tournament detail page.
 */

import { useState } from 'react';
import { useCreateCompetition } from '../hooks/useCreateCompetition';

interface CreateCompetitionFormProps {
  tournamentId: string;
  tournamentName: string;
}

export function CreateCompetitionForm({
  tournamentId,
  tournamentName,
}: CreateCompetitionFormProps) {
  const [name, setName] = useState('');
  const { create, loading, error } = useCreateCompetition();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    try {
      await create(tournamentId, trimmed);
    } catch {
      // Error is set in hook; re-throw handled by hook
    }
  };

  return (
    <div className="mt-6 pt-6 border-t border-gray-200">
      <h3 className="text-lg font-medium text-gray-900 mb-3">Create a competition</h3>
      <p className="text-sm text-gray-600 mb-4">
        Start a private competition for this tournament. Invite friends to join and make picks.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="competition-name" className="block text-sm font-medium text-gray-700 mb-1">
            Competition name
          </label>
          <input
            id="competition-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`e.g. ${tournamentName} Pool`}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            disabled={loading}
            required
            minLength={1}
            maxLength={100}
          />
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3">
            <p className="text-sm text-red-800">{error.message}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating...' : 'Create competition'}
        </button>
      </form>
    </div>
  );
}
