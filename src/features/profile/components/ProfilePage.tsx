/**
 * ProfilePage
 *
 * Lets users set their display name, team color, and Venmo link.
 * These appear in draft order, competition leaderboards, and annual rankings.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';

type TeamColor = 'yellow' | 'red' | 'green' | 'blue';

interface UserProfile {
  display_name: string | null;
  team_color: TeamColor | null;
  venmo_link: string | null;
  phone_number: string | null;
}

const COLOR_OPTIONS: { value: TeamColor; label: string; bg: string; ring: string; dot: string }[] = [
  { value: 'yellow', label: 'Yellow', bg: 'bg-yellow-400', ring: 'ring-yellow-500', dot: 'bg-yellow-400' },
  { value: 'red',    label: 'Red',    bg: 'bg-red-500',    ring: 'ring-red-500',    dot: 'bg-red-500'    },
  { value: 'green',  label: 'Green',  bg: 'bg-green-500',  ring: 'ring-green-500',  dot: 'bg-green-500'  },
  { value: 'blue',   label: 'Blue',   bg: 'bg-blue-500',   ring: 'ring-blue-500',   dot: 'bg-blue-500'   },
];

export function ProfilePage() {
  const { user } = useAuth();

  const [profile, setProfile] = useState<UserProfile>({
    display_name: '',
    team_color: null,
    venmo_link: '',
    phone_number: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadProfile();
  }, [user]);

  async function loadProfile() {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_profiles')
      .select('display_name, team_color, venmo_link, phone_number')
      .eq('id', user!.id)
      .single();

    if (data) {
      setProfile({
        display_name: data.display_name ?? '',
        team_color: (data.team_color as TeamColor) ?? null,
        venmo_link: data.venmo_link ?? '',
        phone_number: data.phone_number ?? '',
      });
    } else if (error && error.code !== 'PGRST116') {
      setError('Failed to load profile.');
    }
    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setError(null);
    setSaved(false);

    const displayName = profile.display_name?.trim() || null;
    const venmoLink = profile.venmo_link?.trim() || null;
    // Normalize phone to E.164: strip everything except digits and leading +
    const rawPhone = profile.phone_number?.trim() || '';
    const phoneNumber = rawPhone
      ? rawPhone.startsWith('+')
        ? rawPhone.replace(/[^\d+]/g, '')
        : '+1' + rawPhone.replace(/\D/g, '')
      : null;

    const { error: upsertError } = await supabase
      .from('user_profiles')
      .upsert(
        {
          id: user.id,
          display_name: displayName,
          team_color: profile.team_color,
          venmo_link: venmoLink,
          phone_number: phoneNumber,
        },
        { onConflict: 'id' }
      );

    setSaving(false);

    if (upsertError) {
      setError(`Failed to save: ${upsertError.message}`);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Loading profile…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Your Profile</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Your display name and team color appear in draft order, leaderboards, and rankings.
        </p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Color bar */}
        <div className="h-1 flex">
          <div className="flex-1 bg-green-500" />
          <div className="flex-1 bg-red-500" />
          <div className="flex-1 bg-blue-500" />
          <div className="flex-1 bg-yellow-400" />
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          {/* Display Name */}
          <div>
            <label htmlFor="display-name" className="block text-sm font-medium text-gray-700 mb-1.5">
              Display Name
            </label>
            <input
              id="display-name"
              type="text"
              maxLength={30}
              placeholder="e.g. Tiger W."
              value={profile.display_name ?? ''}
              onChange={(e) => setProfile((p) => ({ ...p, display_name: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
            />
            <p className="mt-1.5 text-xs text-gray-400">Shows instead of "Player" in draft and leaderboard.</p>
          </div>

          {/* Team Color */}
          <div>
            <span className="block text-sm font-medium text-gray-700 mb-2.5">Team Color</span>
            <div className="flex gap-3 flex-wrap">
              {COLOR_OPTIONS.map((c) => {
                const selected = profile.team_color === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setProfile((p) => ({ ...p, team_color: c.value }))}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                      selected
                        ? `border-gray-800 ring-2 ${c.ring} shadow-md`
                        : 'border-gray-100 hover:border-gray-300'
                    }`}
                  >
                    <span className={`w-9 h-9 rounded-full ${c.bg} shadow-sm`} />
                    <span className="text-xs text-gray-600 font-medium">{c.label}</span>
                  </button>
                );
              })}
              {profile.team_color && (
                <button
                  type="button"
                  onClick={() => setProfile((p) => ({ ...p, team_color: null }))}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 border-gray-100 hover:border-gray-300 text-gray-400 transition-all"
                >
                  <span className="w-9 h-9 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-base">✕</span>
                  <span className="text-xs text-gray-500">None</span>
                </button>
              )}
            </div>
          </div>

          {/* Venmo Link */}
          <div>
            <label htmlFor="venmo-link" className="block text-sm font-medium text-gray-700 mb-1.5">
              Venmo Link <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="venmo-link"
              type="url"
              placeholder="https://venmo.com/u/your-username"
              value={profile.venmo_link ?? ''}
              onChange={(e) => setProfile((p) => ({ ...p, venmo_link: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
            />
            <p className="mt-1.5 text-xs text-gray-400">Shown to other players when competition payments are settled.</p>
          </div>

          {/* Phone Number */}
          <div>
            <label htmlFor="phone-number" className="block text-sm font-medium text-gray-700 mb-1.5">
              Phone Number <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="phone-number"
              type="tel"
              placeholder="+1 (555) 555-5555"
              value={profile.phone_number ?? ''}
              onChange={(e) => setProfile((p) => ({ ...p, phone_number: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
            />
            <p className="mt-1.5 text-xs text-gray-400 flex items-center gap-1">
              <span>📱</span> You'll receive a text message when it's your turn to draft.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center gap-4 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving…' : 'Save Profile'}
            </button>
            {saved && (
              <span className="text-sm text-green-600 font-semibold">✓ Saved!</span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
