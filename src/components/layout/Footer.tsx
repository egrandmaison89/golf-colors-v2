/**
 * Footer — shared across all pages.
 * Uses the same dark brand style as the homepage.
 */

import { Link } from 'react-router-dom';

type TeamColor = 'green' | 'red' | 'blue' | 'yellow';

function ColorDot({ color }: { color: TeamColor }) {
  const cls = { green: 'bg-green-500', red: 'bg-red-500', blue: 'bg-blue-500', yellow: 'bg-yellow-400' }[color];
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${cls}`} />;
}

function ColorBar() {
  return (
    <div className="h-1 w-full flex">
      <div className="flex-1 bg-green-500" />
      <div className="flex-1 bg-red-500" />
      <div className="flex-1 bg-blue-500" />
      <div className="flex-1 bg-yellow-400" />
    </div>
  );
}

export function Footer() {
  return (
    <footer className="bg-gray-950 border-t border-gray-800 mt-auto">
      <ColorBar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-gray-500 text-sm">
          <div className="flex items-center gap-2.5">
            <div className="flex gap-1">
              {(['green', 'red', 'blue', 'yellow'] as TeamColor[]).map((c) => (
                <ColorDot key={c} color={c} />
              ))}
            </div>
            <span className="font-bold text-gray-200 text-base tracking-tight">Golf Colors</span>
          </div>
          <p className="text-gray-600 text-xs">Built for PGA Tour fans who like to compete.</p>
          <nav className="flex gap-5 text-xs">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <Link to="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
            <Link to="/tournaments" className="hover:text-white transition-colors">Tournaments</Link>
            <Link to="/leaderboard" className="hover:text-white transition-colors">Leaderboard</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
