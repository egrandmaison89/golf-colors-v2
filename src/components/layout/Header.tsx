/**
 * Header — global navigation bar with Golf Colors branding.
 * Dark background, four-color accent bar, user profile dot.
 */

import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';

type TeamColor = 'yellow' | 'red' | 'green' | 'blue';

const COLOR_DOT: Record<TeamColor, string> = {
  yellow: 'bg-yellow-400',
  red: 'bg-red-500',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
};

function ColorBar() {
  return (
    <div className="h-0.5 w-full flex">
      <div className="flex-1 bg-green-500" />
      <div className="flex-1 bg-red-500" />
      <div className="flex-1 bg-blue-500" />
      <div className="flex-1 bg-yellow-400" />
    </div>
  );
}

export function Header() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [teamColor, setTeamColor] = useState<TeamColor | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setDisplayName(null);
      setTeamColor(null);
      return;
    }
    supabase
      .from('user_profiles')
      .select('display_name, team_color')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setDisplayName(data.display_name ?? null);
          setTeamColor((data.team_color as TeamColor) ?? null);
        }
      });
  }, [user?.id]);

  // Close mobile menu on nav
  useEffect(() => setMenuOpen(false), [location.pathname]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const nameLabel = displayName ?? user?.email ?? '';

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const navLinkClass = (path: string) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      isActive(path)
        ? 'bg-white/10 text-white'
        : 'text-gray-400 hover:text-white hover:bg-white/5'
    }`;

  return (
    <header className="bg-gray-950 sticky top-0 z-50 shadow-lg">
      <ColorBar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="flex gap-0.5">
              {(['green', 'red', 'blue', 'yellow'] as TeamColor[]).map((c) => (
                <span key={c} className={`w-2 h-2 rounded-full ${COLOR_DOT[c]}`} />
              ))}
            </div>
            <span className="text-white font-extrabold text-base tracking-tight">
              Golf <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-400">Colors</span>
            </span>
          </Link>

          {/* Desktop nav */}
          {user && (
            <nav className="hidden md:flex items-center gap-1">
              <Link to="/dashboard" className={navLinkClass('/dashboard')}>Dashboard</Link>
              <Link to="/tournaments" className={navLinkClass('/tournaments')}>Tournaments</Link>
              <Link to="/leaderboard" className={navLinkClass('/leaderboard')}>Annual Rankings</Link>
            </nav>
          )}

          {/* Right side */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                {/* Profile link */}
                <Link
                  to="/profile"
                  className="hidden sm:flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
                >
                  {teamColor ? (
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${COLOR_DOT[teamColor]}`} />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-gray-600" />
                  )}
                  <span className="truncate max-w-[120px] text-sm">{nameLabel}</span>
                </Link>
                <button
                  onClick={handleSignOut}
                  className="hidden sm:block text-xs text-gray-500 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-md transition-colors"
                >
                  Sign out
                </button>

                {/* Mobile hamburger */}
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="md:hidden text-gray-400 hover:text-white p-1"
                  aria-label="Toggle menu"
                >
                  {menuOpen ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  )}
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm text-gray-400 hover:text-white transition-colors">Sign in</Link>
                <Link
                  to="/signup"
                  className="text-sm font-semibold text-white bg-green-600 hover:bg-green-500 px-3 py-1.5 rounded-md transition-colors"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {menuOpen && user && (
        <div className="md:hidden border-t border-gray-800 bg-gray-950 px-4 py-3 space-y-1">
          <Link to="/dashboard" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5">Dashboard</Link>
          <Link to="/tournaments" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5">Tournaments</Link>
          <Link to="/leaderboard" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5">Annual Rankings</Link>
          <Link to="/profile" className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5">
            {teamColor && <span className={`w-2.5 h-2.5 rounded-full ${COLOR_DOT[teamColor]}`} />}
            {nameLabel}
          </Link>
          <button onClick={handleSignOut} className="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-500 hover:text-white">Sign out</button>
        </div>
      )}
    </header>
  );
}
