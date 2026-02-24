import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { LoginPage } from '@/features/auth/components/LoginPage';
import { SignupPage } from '@/features/auth/components/SignupPage';
import { TournamentList } from '@/features/tournaments/components/TournamentList';
import { TournamentDetail } from '@/features/tournaments/components/TournamentDetail';
import { CompetitionList } from '@/features/competitions/components/CompetitionList';
import { CompetitionDetail } from '@/features/competitions/components/CompetitionDetail';
import { AnnualLeaderboardPage } from '@/features/leaderboard/components/AnnualLeaderboardPage';
import { JoinPage } from '@/features/competitions/components/JoinPage';
import { ProfilePage } from '@/features/profile/components/ProfilePage';
import { HomePage } from '@/features/home/components/HomePage';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import './App.css';

/**
 * Root App component.
 */
function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          {/* The homepage manages its own full-bleed layout; all other pages use the shared shell */}
          <Routes>
            <Route path="/" element={<HomeLayout />} />
            <Route path="*" element={<AppShell />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

/**
 * HomeLayout — homepage gets its own dark full-bleed treatment with Header on top.
 */
function HomeLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      <Header />
      <main className="flex-1">
        <HomePage />
      </main>
    </div>
  );
}

/**
 * AppShell — all inner pages share this layout:
 *   dark Header → light gray content area → dark Footer
 */
function AppShell() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <PageContainer>
                  <DashboardPage />
                </PageContainer>
              </ProtectedRoute>
            }
          />
          <Route
            path="/leaderboard"
            element={
              <ProtectedRoute>
                <AnnualLeaderboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tournaments"
            element={
              <ProtectedRoute>
                <PageContainer>
                  <TournamentList />
                </PageContainer>
              </ProtectedRoute>
            }
          />
          <Route
            path="/tournaments/:id"
            element={
              <ProtectedRoute>
                <PageContainer>
                  <TournamentDetail />
                </PageContainer>
              </ProtectedRoute>
            }
          />
          <Route
            path="/competitions"
            element={
              <ProtectedRoute>
                <PageContainer>
                  <CompetitionList />
                </PageContainer>
              </ProtectedRoute>
            }
          />
          <Route
            path="/competitions/:id"
            element={
              <ProtectedRoute>
                <PageContainer>
                  <CompetitionDetail />
                </PageContainer>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          {/* Public route: invite link */}
          <Route path="/join/:inviteCode" element={<PageContainer><JoinPage /></PageContainer>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

/**
 * Standard content container — max-width, horizontal padding, vertical spacing.
 */
function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {children}
    </div>
  );
}

/**
 * Dashboard page — lists user competitions.
 */
function DashboardPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Dashboard</h1>
      <CompetitionList />
    </>
  );
}

export default App;
