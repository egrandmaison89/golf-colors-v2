/**
 * AdminPanel
 *
 * Collapsible admin toolkit for managing competitions.
 * Provides: edit team selections, edit alternates, edit tournament results, quick actions.
 * Only rendered when user is an admin.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  adminSwapDraftPick,
  adminUpdateAlternate,
  adminEditTournamentResult,
  adminForceSyncResults,
  adminResetFinalization,
  adminResetDraft,
  type TournamentResultEdits,
} from '../services/adminService';

interface AdminPanelProps {
  competitionId: string;
  tournamentId: string;
  sportsdataId: string | null;
  adminUserId: string;
  onDataChanged: () => void;
}

interface ParticipantInfo {
  userId: string;
  displayName: string;
  teamColor: string | null;
}

interface PickInfo {
  id: string;
  golferId: string;
  golferName: string;
  draftRound: number;
  pickNumber: number;
}

interface GolferOption {
  id: string;
  displayName: string;
  worldRanking: number | null;
}

interface TournamentResultRow {
  golferId: string;
  golferName: string;
  position: number | null;
  totalToPar: number | null;
  madeCut: boolean | null;
  withdrew: boolean | null;
  manualOverride: boolean;
}

const COLOR_DOT_CLASSES: Record<string, string> = {
  yellow: 'bg-yellow-400',
  red: 'bg-red-500',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
};

export function AdminPanel({
  competitionId,
  tournamentId,
  sportsdataId: _sportsdataId,
  adminUserId,
  onDataChanged,
}: AdminPanelProps) {
  void _sportsdataId; // Reserved for future use (direct API calls from admin panel)
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(false);

  // Data
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [picks, setPicks] = useState<Map<string, PickInfo[]>>(new Map());
  const [alternates, setAlternates] = useState<Map<string, { golferId: string; golferName: string }>>(new Map());
  const [tournamentGolfers, setTournamentGolfers] = useState<GolferOption[]>([]);
  const [tournamentResults, setTournamentResults] = useState<TournamentResultRow[]>([]);

  // Selection state
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [swapPickId, setSwapPickId] = useState<string | null>(null);
  const [golferSearch, setGolferSearch] = useState('');
  const [editingResult, setEditingResult] = useState<TournamentResultRow | null>(null);
  const [resultSearch, setResultSearch] = useState('');

  // Edit result form state
  const [editToPar, setEditToPar] = useState<string>('');
  const [editMadeCut, setEditMadeCut] = useState<string>('');
  const [editWithdrew, setEditWithdrew] = useState<string>('');
  const [editPosition, setEditPosition] = useState<string>('');

  // Load participants and picks data
  const loadData = useCallback(async () => {
    // Fetch participants
    const { data: parts } = await supabase
      .from('competition_participants')
      .select('user_id')
      .eq('competition_id', competitionId);

    const userIds = (parts ?? []).map((p) => p.user_id);
    if (userIds.length === 0) return;

    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, display_name, team_color')
      .in('id', userIds);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    setParticipants(
      userIds.map((uid) => ({
        userId: uid,
        displayName: profileMap.get(uid)?.display_name ?? 'Player',
        teamColor: profileMap.get(uid)?.team_color ?? null,
      }))
    );

    // Fetch draft picks
    const { data: draftPicks } = await supabase
      .from('draft_picks')
      .select('id, user_id, golfer_id, draft_round, pick_number, golfers(display_name)')
      .eq('competition_id', competitionId)
      .order('pick_number');

    const picksMap = new Map<string, PickInfo[]>();
    for (const dp of (draftPicks ?? []) as any[]) {
      const golfer = Array.isArray(dp.golfers) ? dp.golfers[0] : dp.golfers;
      const info: PickInfo = {
        id: dp.id,
        golferId: dp.golfer_id,
        golferName: golfer?.display_name ?? 'Unknown',
        draftRound: dp.draft_round,
        pickNumber: dp.pick_number,
      };
      const list = picksMap.get(dp.user_id) ?? [];
      list.push(info);
      picksMap.set(dp.user_id, list);
    }
    setPicks(picksMap);

    // Fetch alternates
    const { data: alts } = await supabase
      .from('alternates')
      .select('user_id, golfer_id, golfers(display_name)')
      .eq('competition_id', competitionId);

    const altMap = new Map<string, { golferId: string; golferName: string }>();
    for (const a of (alts ?? []) as any[]) {
      const golfer = Array.isArray(a.golfers) ? a.golfers[0] : a.golfers;
      altMap.set(a.user_id, {
        golferId: a.golfer_id,
        golferName: golfer?.display_name ?? 'Unknown',
      });
    }
    setAlternates(altMap);

    // Fetch tournament golfers (for swap selector)
    const { data: tgData } = await supabase
      .from('tournament_golfers')
      .select('golfer_id, golfers(id, display_name, world_ranking)')
      .eq('tournament_id', tournamentId)
      .eq('is_alternate', false);

    const golfers: GolferOption[] = ((tgData ?? []) as any[]).map((tg) => {
      const g = Array.isArray(tg.golfers) ? tg.golfers[0] : tg.golfers;
      return {
        id: g?.id ?? tg.golfer_id,
        displayName: g?.display_name ?? 'Unknown',
        worldRanking: g?.world_ranking ?? null,
      };
    });
    golfers.sort((a, b) => a.displayName.localeCompare(b.displayName));
    setTournamentGolfers(golfers);
  }, [competitionId, tournamentId]);

  // Load tournament results for editing
  const loadResults = useCallback(async () => {
    const { data: results } = await supabase
      .from('tournament_results')
      .select('golfer_id, position, total_to_par, made_cut, withdrew, manual_override, golfers(display_name)')
      .eq('tournament_id', tournamentId)
      .order('position', { ascending: true, nullsFirst: false });

    setTournamentResults(
      ((results ?? []) as any[]).map((r) => {
        const golfer = Array.isArray(r.golfers) ? r.golfers[0] : r.golfers;
        return {
          golferId: r.golfer_id,
          golferName: golfer?.display_name ?? 'Unknown',
          position: r.position,
          totalToPar: r.total_to_par,
          madeCut: r.made_cut,
          withdrew: r.withdrew,
          manualOverride: r.manual_override ?? false,
        };
      })
    );
  }, [tournamentId]);

  useEffect(() => {
    if (isOpen) {
      loadData();
      loadResults();
    }
  }, [isOpen, loadData, loadResults]);

  const showStatus = (text: string, type: 'success' | 'error') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Set the first participant as default when loaded
  useEffect(() => {
    if (participants.length > 0 && !selectedUserId) {
      setSelectedUserId(participants[0].userId);
    }
  }, [participants, selectedUserId]);

  // ── Handlers ──

  const handleSwapPick = async (golferId: string) => {
    if (!swapPickId) return;
    const pick = [...picks.values()].flat().find((p) => p.id === swapPickId);
    if (!pick) return;

    const newGolfer = tournamentGolfers.find((g) => g.id === golferId);
    if (!window.confirm(
      `Swap ${pick.golferName} → ${newGolfer?.displayName ?? 'Unknown'} on this team?`
    )) return;

    setLoading(true);
    try {
      await adminSwapDraftPick(adminUserId, competitionId, swapPickId, golferId);
      showStatus(`Swapped ${pick.golferName} → ${newGolfer?.displayName}`, 'success');
      setSwapPickId(null);
      setGolferSearch('');
      await loadData();
      onDataChanged();
    } catch (err) {
      showStatus(err instanceof Error ? err.message : 'Swap failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAlternate = async (golferId: string) => {
    if (!selectedUserId) return;
    const newGolfer = tournamentGolfers.find((g) => g.id === golferId);
    const participant = participants.find((p) => p.userId === selectedUserId);
    if (!window.confirm(
      `Set ${newGolfer?.displayName ?? 'Unknown'} as alternate for ${participant?.displayName ?? 'Player'}?`
    )) return;

    setLoading(true);
    try {
      await adminUpdateAlternate(adminUserId, competitionId, selectedUserId, golferId);
      showStatus(`Alternate updated for ${participant?.displayName}`, 'success');
      setGolferSearch('');
      await loadData();
      onDataChanged();
    } catch (err) {
      showStatus(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditResult = (result: TournamentResultRow) => {
    setEditingResult(result);
    setEditToPar(result.totalToPar?.toString() ?? '');
    setEditMadeCut(result.madeCut === null ? 'null' : result.madeCut ? 'true' : 'false');
    setEditWithdrew(result.withdrew === null ? 'null' : result.withdrew ? 'true' : 'false');
    setEditPosition(result.position?.toString() ?? '');
  };

  const handleSaveResult = async () => {
    if (!editingResult) return;

    const updates: TournamentResultEdits = {};
    const newToPar = editToPar === '' ? null : parseInt(editToPar, 10);
    const newMadeCut = editMadeCut === 'null' ? null : editMadeCut === 'true';
    const newWithdrew = editWithdrew === 'null' ? null : editWithdrew === 'true';
    const newPosition = editPosition === '' ? null : parseInt(editPosition, 10);

    if (newToPar !== editingResult.totalToPar) updates.total_to_par = newToPar;
    if (newMadeCut !== editingResult.madeCut) updates.made_cut = newMadeCut;
    if (newWithdrew !== editingResult.withdrew) updates.withdrew = newWithdrew;
    if (newPosition !== editingResult.position) updates.position = newPosition;

    if (Object.keys(updates).length === 0) {
      setEditingResult(null);
      return;
    }

    if (!window.confirm(
      `Save manual override for ${editingResult.golferName}? This will persist through API syncs.`
    )) return;

    setLoading(true);
    try {
      await adminEditTournamentResult(adminUserId, tournamentId, editingResult.golferId, updates);
      showStatus(`Updated ${editingResult.golferName} (manual override)`, 'success');
      setEditingResult(null);
      await loadResults();
      onDataChanged();
    } catch (err) {
      showStatus(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleForceSync = async (clearOverrides: boolean = false) => {
    const msg = clearOverrides
      ? 'Force sync ALL results from API and clear manual overrides?'
      : 'Force sync results from API? Manual overrides will be preserved.';
    if (!window.confirm(msg)) return;

    setLoading(true);
    try {
      await adminForceSyncResults(adminUserId, competitionId, clearOverrides);
      showStatus('Results synced from API', 'success');
      await loadResults();
      onDataChanged();
    } catch (err) {
      showStatus(err instanceof Error ? err.message : 'Sync failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetFinalization = async () => {
    if (!window.confirm(
      'Reset finalization? This deletes all scores, payments, and bounties for this competition and reverses annual leaderboard entries. The competition will re-finalize on the next page load.'
    )) return;

    setLoading(true);
    try {
      await adminResetFinalization(adminUserId, competitionId);
      showStatus('Finalization reset. Scores will recalculate on next load.', 'success');
      onDataChanged();
    } catch (err) {
      showStatus(err instanceof Error ? err.message : 'Reset failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetDraft = async () => {
    if (!window.confirm(
      'RESET ENTIRE DRAFT? This will delete all picks, alternates, draft order, and any finalized scores. The competition will return to "not started" state. This cannot be undone.'
    )) return;

    setLoading(true);
    try {
      await adminResetDraft(adminUserId, competitionId);
      showStatus('Draft reset to not_started', 'success');
      onDataChanged();
    } catch (err) {
      showStatus(err instanceof Error ? err.message : 'Reset failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Filter golfers for swap/alternate ──

  const draftedGolferIds = new Set([...picks.values()].flat().map((p) => p.golferId));
  const filteredGolfers = tournamentGolfers.filter(
    (g) =>
      !draftedGolferIds.has(g.id) &&
      g.displayName.toLowerCase().includes(golferSearch.toLowerCase())
  );

  const filteredResults = tournamentResults.filter(
    (r) => r.golferName.toLowerCase().includes(resultSearch.toLowerCase())
  );

  const selectedPicks = picks.get(selectedUserId) ?? [];
  const selectedAlternate = alternates.get(selectedUserId);

  const fmtScore = (n: number | null) => {
    if (n === null) return '—';
    return n === 0 ? 'E' : n > 0 ? `+${n}` : `${n}`;
  };

  return (
    <div className="mt-5 pt-5 border-t border-gray-100">
      {/* Header toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between group"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-orange-500 uppercase tracking-widest">
            Admin Toolkit
          </span>
          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-600 rounded">
            ADMIN
          </span>
        </div>
        <span className="text-orange-400 group-hover:text-orange-600 transition-colors text-sm">
          {isOpen ? '▲ Hide' : '▼ Show'}
        </span>
      </button>

      {/* Status message */}
      {statusMessage && (
        <div className={`mt-2 px-3 py-2 rounded-lg text-sm font-medium ${
          statusMessage.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-100'
            : 'bg-red-50 text-red-700 border border-red-100'
        }`}>
          {statusMessage.text}
        </div>
      )}

      {isOpen && (
        <div className="mt-3 space-y-2">
          {/* Section tabs */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { key: 'picks', label: 'Edit Picks' },
              { key: 'alternates', label: 'Edit Alternates' },
              { key: 'results', label: 'Edit Results' },
              { key: 'actions', label: 'Quick Actions' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveSection(activeSection === key ? null : key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                  activeSection === key
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-white text-orange-700 border-orange-200 hover:bg-orange-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Edit Picks Section ── */}
          {activeSection === 'picks' && (
            <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-4 space-y-3">
              <p className="text-xs text-orange-700 font-medium">
                Swap a golfer on any team. Changes take effect immediately.
              </p>

              {/* User selector */}
              <ParticipantSelector
                participants={participants}
                selectedUserId={selectedUserId}
                onChange={setSelectedUserId}
              />

              {/* Current picks */}
              {selectedPicks.length > 0 ? (
                <div className="space-y-1.5">
                  {selectedPicks.sort((a, b) => a.draftRound - b.draftRound).map((pick) => (
                    <div key={pick.id} className="flex items-center gap-2 bg-white rounded-lg border border-gray-100 px-3 py-2">
                      <span className="text-xs text-gray-400 font-mono w-8">R{pick.draftRound}</span>
                      <span className="text-sm font-medium text-gray-900 flex-1">{pick.golferName}</span>
                      {swapPickId === pick.id ? (
                        <button
                          onClick={() => { setSwapPickId(null); setGolferSearch(''); }}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Cancel
                        </button>
                      ) : (
                        <button
                          onClick={() => { setSwapPickId(pick.id); setGolferSearch(''); }}
                          disabled={loading}
                          className="text-xs px-2 py-1 rounded border border-orange-200 text-orange-600 hover:bg-orange-50 disabled:opacity-50"
                        >
                          Swap
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No picks yet</p>
              )}

              {/* Golfer selector when swapping */}
              {swapPickId && (
                <GolferSelector
                  golfers={filteredGolfers}
                  search={golferSearch}
                  onSearchChange={setGolferSearch}
                  onSelect={handleSwapPick}
                  loading={loading}
                  placeholder="Search for replacement golfer…"
                />
              )}
            </div>
          )}

          {/* ── Edit Alternates Section ── */}
          {activeSection === 'alternates' && (
            <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-4 space-y-3">
              <p className="text-xs text-orange-700 font-medium">
                Set or change the alternate for any team.
              </p>

              <ParticipantSelector
                participants={participants}
                selectedUserId={selectedUserId}
                onChange={setSelectedUserId}
              />

              <div className="bg-white rounded-lg border border-gray-100 px-3 py-2">
                <span className="text-xs text-gray-400 mr-2">Current alternate:</span>
                <span className="text-sm font-medium text-gray-900">
                  {selectedAlternate ? selectedAlternate.golferName : 'None'}
                </span>
              </div>

              <GolferSelector
                golfers={filteredGolfers}
                search={golferSearch}
                onSearchChange={setGolferSearch}
                onSelect={handleUpdateAlternate}
                loading={loading}
                placeholder="Search for new alternate…"
              />
            </div>
          )}

          {/* ── Edit Results Section ── */}
          {activeSection === 'results' && (
            <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-4 space-y-3">
              <p className="text-xs text-orange-700 font-medium">
                Edit tournament results. Overrides persist through API syncs.
              </p>

              <input
                type="text"
                value={resultSearch}
                onChange={(e) => setResultSearch(e.target.value)}
                placeholder="Search golfer by name…"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-orange-300"
              />

              {/* Results list */}
              <div className="max-h-60 overflow-y-auto space-y-1">
                {filteredResults.slice(0, 30).map((result) => (
                  <div
                    key={result.golferId}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                      editingResult?.golferId === result.golferId
                        ? 'bg-orange-100 border-orange-300'
                        : 'bg-white border-gray-100 hover:border-gray-200'
                    }`}
                    onClick={() => handleEditResult(result)}
                  >
                    <span className="text-xs text-gray-400 w-8 text-right font-mono">
                      {result.withdrew ? 'WD' : result.madeCut === false ? 'MC' : result.position ?? '—'}
                    </span>
                    <span className="text-sm font-medium text-gray-900 flex-1">{result.golferName}</span>
                    <span className="text-xs font-mono text-gray-600">{fmtScore(result.totalToPar)}</span>
                    {result.manualOverride && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 rounded">
                        OVERRIDE
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Edit form */}
              {editingResult && (
                <div className="bg-white rounded-lg border border-orange-200 p-3 space-y-2">
                  <p className="text-sm font-semibold text-gray-900">
                    Editing: {editingResult.golferName}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 font-medium">To Par</label>
                      <input
                        type="number"
                        value={editToPar}
                        onChange={(e) => setEditToPar(e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-orange-300"
                        placeholder="e.g. -5"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-medium">Position</label>
                      <input
                        type="number"
                        value={editPosition}
                        onChange={(e) => setEditPosition(e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-orange-300"
                        placeholder="e.g. 1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-medium">Made Cut</label>
                      <select
                        value={editMadeCut}
                        onChange={(e) => setEditMadeCut(e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-orange-300"
                      >
                        <option value="true">Yes</option>
                        <option value="false">No (MC)</option>
                        <option value="null">Unknown</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-medium">Withdrew</label>
                      <select
                        value={editWithdrew}
                        onChange={(e) => setEditWithdrew(e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-orange-300"
                      >
                        <option value="false">No</option>
                        <option value="true">Yes (WD)</option>
                        <option value="null">Unknown</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleSaveResult}
                      disabled={loading}
                      className="px-3 py-1.5 text-xs font-semibold bg-orange-600 text-white rounded-lg hover:bg-orange-500 disabled:opacity-50"
                    >
                      {loading ? 'Saving…' : 'Save Override'}
                    </button>
                    <button
                      onClick={() => setEditingResult(null)}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Quick Actions Section ── */}
          {activeSection === 'actions' && (
            <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-4 space-y-3">
              <p className="text-xs text-orange-700 font-medium">
                System-level actions for this competition.
              </p>

              <div className="space-y-2">
                {/* Force sync */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleForceSync(false)}
                    disabled={loading}
                    className="px-3 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors"
                  >
                    {loading ? 'Syncing…' : '🔄 Force Sync Results'}
                  </button>
                  <button
                    onClick={() => handleForceSync(true)}
                    disabled={loading}
                    className="px-3 py-2 text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-200 disabled:opacity-50 transition-colors"
                  >
                    🔄 Sync + Clear Overrides
                  </button>
                </div>

                {/* Destructive actions */}
                <div className="pt-2 border-t border-orange-100 space-y-2">
                  <p className="text-xs text-red-500 font-semibold uppercase tracking-wider">Destructive</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleResetFinalization}
                      disabled={loading}
                      className="px-3 py-2 text-xs font-semibold bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                    >
                      🗑 Reset Finalization
                    </button>
                    <button
                      onClick={handleResetDraft}
                      disabled={loading}
                      className="px-3 py-2 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-50 transition-colors"
                    >
                      ⚠️ Reset Entire Draft
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──

function ParticipantSelector({
  participants,
  selectedUserId,
  onChange,
}: {
  participants: ParticipantInfo[];
  selectedUserId: string;
  onChange: (userId: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {participants.map((p) => {
        const dotClass = p.teamColor && p.teamColor in COLOR_DOT_CLASSES
          ? COLOR_DOT_CLASSES[p.teamColor]
          : 'bg-gray-300';
        return (
          <button
            key={p.userId}
            onClick={() => onChange(p.userId)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              selectedUserId === p.userId
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white text-gray-700 border-gray-200 hover:border-orange-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${selectedUserId === p.userId ? 'bg-white/60' : dotClass}`} />
            {p.displayName}
          </button>
        );
      })}
    </div>
  );
}

function GolferSelector({
  golfers,
  search,
  onSearchChange,
  onSelect,
  loading,
  placeholder,
}: {
  golfers: GolferOption[];
  search: string;
  onSearchChange: (val: string) => void;
  onSelect: (golferId: string) => void;
  loading: boolean;
  placeholder: string;
}) {
  return (
    <div className="space-y-1.5">
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-orange-300"
      />
      {search.length >= 2 && (
        <div className="max-h-40 overflow-y-auto space-y-0.5">
          {golfers.slice(0, 20).map((g) => (
            <button
              key={g.id}
              onClick={() => onSelect(g.id)}
              disabled={loading}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm rounded-lg hover:bg-orange-50 disabled:opacity-50 transition-colors"
            >
              <span className="font-medium text-gray-900 flex-1">{g.displayName}</span>
              {g.worldRanking && (
                <span className="text-xs text-gray-400">#{g.worldRanking}</span>
              )}
            </button>
          ))}
          {golfers.length === 0 && (
            <p className="text-xs text-gray-400 py-2 px-3">No available golfers found</p>
          )}
        </div>
      )}
    </div>
  );
}
