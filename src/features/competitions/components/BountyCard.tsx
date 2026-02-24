/**
 * BountyCard component
 *
 * Displays bounty results when a drafted golfer wins the tournament outright.
 * Only rendered when tournament status === 'completed'.
 */

import { useState, useEffect } from 'react';
import { calculateBounties } from '../services/bountyService';
import type { BountyResult } from '../services/bountyService';
import type { LeaderboardEntry } from '../services/scoringService';

interface BountyCardProps {
  competitionId: string;
  leaderboard: LeaderboardEntry[];
}

export function BountyCard({ competitionId, leaderboard }: BountyCardProps) {
  const [bounty, setBounty] = useState<BountyResult | null | undefined>(undefined); // undefined = loading
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!competitionId || leaderboard.length === 0) {
      setBounty(null);
      return;
    }

    calculateBounties(competitionId, leaderboard)
      .then((result) => setBounty(result))
      .catch((err) => {
        console.error('BountyCard error:', err);
        setError('Failed to load bounty info');
        setBounty(null);
      });
  }, [competitionId, leaderboard]);

  if (bounty === undefined) {
    return null; // Still loading
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (bounty === null) {
    // No bounty: winner wasn't drafted
    return (
      <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🏌️</span>
          <h4 className="font-medium text-gray-700">Bounty</h4>
        </div>
        <p className="text-sm text-gray-500">
          No bounty this week — the tournament winner wasn't drafted.
        </p>
      </div>
    );
  }

  const roundLabel = bounty.pickRound === 1 ? '1st' : bounty.pickRound === 2 ? '2nd' : '3rd';

  return (
    <div className="rounded-lg bg-amber-50 border border-amber-300 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-2xl">🏆</span>
        <div>
          <h4 className="font-semibold text-amber-900">Bounty Triggered!</h4>
          <p className="text-sm text-amber-700">
            <strong>{bounty.golferName}</strong> won the tournament — drafted by{' '}
            <strong>{bounty.winnerDisplayName}</strong> in round {roundLabel}.
          </p>
        </div>
      </div>

      {/* Total bounty */}
      <div className="bg-amber-100 rounded-md px-3 py-2 flex justify-between items-center">
        <span className="text-sm font-medium text-amber-800">Total bounty</span>
        <span className="text-lg font-bold text-amber-900">${bounty.totalBounty}</span>
      </div>

      {/* Payment breakdown */}
      {bounty.payments.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
            Who owes what
          </h5>
          <div className="space-y-1">
            {bounty.payments.map((payment, i) => (
              <div
                key={i}
                className="flex justify-between items-center text-sm text-amber-900 bg-white/60 rounded px-3 py-1.5"
              >
                <span>
                  <strong>{payment.fromDisplayName}</strong>{' '}
                  <span className="text-amber-600">→</span>{' '}
                  <strong>{payment.toDisplayName}</strong>
                </span>
                <span className="font-semibold">${payment.amount}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
