import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { Header } from '@/components/layout/Header';
import { LoginPage } from '@/features/auth/components/LoginPage';
import { SignupPage } from '@/features/auth/components/SignupPage';
import { TournamentList } from '@/features/tournaments/components/TournamentList';
import { TournamentDetail } from '@/features/tournaments/components/TournamentDetail';
import { CompetitionList } from '@/features/competitions/components/CompetitionList';
import { CompetitionDetail } from '@/features/competitions/components/CompetitionDetail';
import './App.css';

/**
 * Root App component.
 * 
 * Sets up routing structure with authentication.
 */
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50">
          <Header />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/leaderboard"
              element={
                <ProtectedRoute>
                  <LeaderboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tournaments"
              element={
                <ProtectedRoute>
                  <TournamentList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tournaments/:id"
              element={
                <ProtectedRoute>
                  <TournamentDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/competitions"
              element={
                <ProtectedRoute>
                  <CompetitionList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/competitions/:id"
              element={
                <ProtectedRoute>
                  <CompetitionDetail />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

/**
 * Home page - public landing page.
 */
function HomePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900">Golf Colors</h1>
      <p className="mt-2 text-gray-600">
        Compete with friends on PGA Tour tournaments
      </p>
    </div>
  );
}

/**
 * Dashboard page - shows user's competitions.
 */
function DashboardPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <CompetitionList />
    </div>
  );
}

/**
 * Annual Leaderboard page - placeholder.
 */
function LeaderboardPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Annual Leaderboard</h1>
      <p className="mt-2 text-gray-600">
        Yearly rankings across all competitions
      </p>
    </div>
  );
}

export default App;