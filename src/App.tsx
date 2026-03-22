// src/App.tsx
import { GoogleAnalytics } from "./components/seo/google-analytics";
import { StructuredData } from "./components/seo/structured-data";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "./stores/auth-store";
import { ProtectedRoute } from "./components/layout/protected-route";
import { ScrollToTop } from "./components/layout/scroll-to-top";
import { HomePage } from "./pages/home";
import { RankingPage } from "./pages/ranking";
import { PlayerProfilePage } from "./pages/player-profile";
import { CalendarPage } from "./pages/calendar";
import { ClubsPage } from "./pages/clubs";
import { ClubDetailPage } from "./pages/club-detail";
import { LeaguesPage } from "./pages/leagues";
import { LeagueDetailPage } from "./pages/league-detail";
import { ComparePage } from "./pages/compare";
import { LoginPage } from "./pages/login";
import { RegisterPage } from "./pages/register";
import { PlayerDashboardPage } from "./pages/player-dashboard";
import { ClubAdminPage } from "./pages/club-admin";
import { SuperAdminPage } from "./pages/super-admin";
import BlogPage from "./pages/blog";
import BlogPostPage from "./pages/blog-post";
import { FloatingCTA } from "./components/marketing/FloatingCTA";
import { TournamentDetailPage } from "./pages/tournament-detail";
import { ToolsPage } from "./pages/tools";
import { PokerQuizPage } from "./pages/poker-quiz";
import { ICMCalculatorPage } from "./pages/icm-calculator";
import { EloSimulatorPage } from "./pages/elo-simulator";
import { BankrollCalculatorPage } from "./pages/bankroll-calculator";
import { ReplayerPage } from "./pages/replayer";


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((s) => s.initialize);
  const initialized = useAuthStore((s) => s.initialized);

  useEffect(() => {
    if (!initialized) {
      const cleanup = initialize();
      return cleanup;
    }
  }, [initialize, initialized]);

  return <>{children}</>;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ScrollToTop />
  	<GoogleAnalytics />
  	<StructuredData />
        <AuthInitializer>
          <Routes>
            {/* Public */}
            <Route path="/" element={<HomePage />} />
            <Route path="/ranking" element={<RankingPage />} />
            <Route path="/ranking/:playerId" element={<PlayerProfilePage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/clubs" element={<ClubsPage />} />
            <Route path="/clubs/:clubId" element={<ClubDetailPage />} />
            <Route path="/leagues" element={<LeaguesPage />} />
            <Route path="/leagues/:leagueId" element={<LeagueDetailPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/tournament/:id" element={<TournamentDetailPage />} />
            <Route path="/tools" element={<ToolsPage />} />
            <Route path="/tools/quiz" element={<PokerQuizPage />} />
            <Route path="/tools/calculadora-icm" element={<ICMCalculatorPage />} />
            <Route path="/tools/simulador-elo" element={<EloSimulatorPage />} />
            <Route path="/tools/calculadora-banca" element={<BankrollCalculatorPage />} />

            <Route path="/tools/replayer" element={
  <ProtectedRoute>
    <ReplayerPage />
  </ProtectedRoute>
} />

            {/* Blog */}
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />

            {/* Protected: any authenticated user */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <PlayerDashboardPage />
                </ProtectedRoute>
              }
            />

            {/* Protected: club admin */}
            <Route
              path="/admin/club"
              element={
                <ProtectedRoute requiredRole={["club_admin", "super_admin"]}>
                  <ClubAdminPage />
                </ProtectedRoute>
              }
            />

            {/* Protected: super admin */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole={["super_admin"]}>
                  <SuperAdminPage />
                </ProtectedRoute>
              }
            />
          </Routes>
          <FloatingCTA />
        </AuthInitializer>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
