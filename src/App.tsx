// src/App.tsx
import { GoogleAnalytics } from "./components/seo/google-analytics";
import { StructuredData } from "./components/seo/structured-data";
import { useEffect, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "./stores/auth-store";
import { ProtectedRoute } from "./components/layout/protected-route";
import { ScrollToTop } from "./components/layout/scroll-to-top";
import { FloatingCTA } from "./components/marketing/FloatingCTA";
import { Spinner } from "./components/ui/spinner";
import { AgeVerificationModal } from "./components/layout/age-verification-modal";
import { EloSystemPage } from "./pages/elo-system";
import { TutorialCsvPage } from "./pages/tutorial-csv";
import { RoomProfilerPage } from "./pages/room-profiler";
import { TutorialClubGGPage } from "./pages/tutorial-clubgg";

// 🔥 Lazy imports (CLAVE)
const HomePage = lazy(() => import("./pages/home").then(m => ({ default: m.HomePage })));
const AcademyPage = lazy(() => import("./pages/academy").then(m => ({ default: m.AcademyPage })));
const AcademyModulePage = lazy(() => import("./pages/academy-module").then(m => ({ default: m.AcademyModulePage })));
const AcademyLessonPage = lazy(() => import("./pages/academy-lesson").then(m => ({ default: m.AcademyLessonPage })));
const RankingPage = lazy(() => import("./pages/ranking").then(m => ({ default: m.RankingPage })));
const PlayerProfilePage = lazy(() => import("./pages/player-profile").then(m => ({ default: m.PlayerProfilePage })));
const CalendarPage = lazy(() => import("./pages/calendar").then(m => ({ default: m.CalendarPage })));
const ClubsPage = lazy(() => import("./pages/clubs").then(m => ({ default: m.ClubsPage })));
const ClubDetailPage = lazy(() => import("./pages/club-detail").then(m => ({ default: m.ClubDetailPage })));
const LeaguesPage = lazy(() => import("./pages/leagues").then(m => ({ default: m.LeaguesPage })));
const LeagueDetailPage = lazy(() => import("./pages/league-detail").then(m => ({ default: m.LeagueDetailPage })));
const ComparePage = lazy(() => import("./pages/compare").then(m => ({ default: m.ComparePage })));
const LoginPage = lazy(() => import("./pages/login").then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("./pages/register").then(m => ({ default: m.RegisterPage })));
const PlayerDashboardPage = lazy(() => import("./pages/player-dashboard").then(m => ({ default: m.PlayerDashboardPage })));
const ClubAdminPage = lazy(() => import("./pages/club-admin").then(m => ({ default: m.ClubAdminPage })));
const SuperAdminPage = lazy(() => import("./pages/super-admin").then(m => ({ default: m.SuperAdminPage })));
const BlogPage = lazy(() => import("./pages/blog"));
const BlogPostPage = lazy(() => import("./pages/blog-post"));
const TournamentDetailPage = lazy(() => import("./pages/tournament-detail").then(m => ({ default: m.TournamentDetailPage })));
const ToolsPage = lazy(() => import("./pages/tools").then(m => ({ default: m.ToolsPage })));
const PokerQuizPage = lazy(() => import("./pages/poker-quiz").then(m => ({ default: m.PokerQuizPage })));
const ICMCalculatorPage = lazy(() => import("./pages/icm-calculator").then(m => ({ default: m.ICMCalculatorPage })));
const EloSimulatorPage = lazy(() => import("./pages/elo-simulator").then(m => ({ default: m.EloSimulatorPage })));
const BankrollCalculatorPage = lazy(() => import("./pages/bankroll-calculator").then(m => ({ default: m.BankrollCalculatorPage })));
const ReplayerPage = lazy(() => import("./pages/replayer").then(m => ({ default: m.ReplayerPage })));
const ShopPage = lazy(() => import("./pages/shop").then(m => ({ default: m.ShopPage })));
const GlossaryPage = lazy(() => import("./pages/glossary").then(m => ({ default: m.GlossaryPage })));
const GlossaryTermPage = lazy(() => import("./pages/glossary-term").then(m => ({ default: m.GlossaryTermPage })));
// 📄 Páginas Legales
const TermsPage = lazy(() => import("./pages/terms").then(m => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import("./pages/privacy").then(m => ({ default: m.PrivacyPage })));
const ForgotPasswordPage = lazy(() => import("./pages/forgot-password").then(m => ({ default: m.ForgotPasswordPage })));
const UpdatePasswordPage = lazy(() => import("./pages/update-password").then(m => ({ default: m.UpdatePasswordPage })));
const WelcomePage = lazy(() => import("./pages/welcome"));

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
          {/* 🔥 Modal de Verificación de Edad Global */}
          <AgeVerificationModal />

          {/* 🔥 Suspense global */}
          <Suspense
            fallback={
              <div className="min-h-screen flex items-center justify-center bg-sk-bg-1">
                <Spinner size="lg" />
              </div>
            }
          >
            <Routes>
              {/* Public */}
              <Route path="/" element={<HomePage />} />
              <Route path="/ranking" element={<RankingPage />} />
              <Route path="/ranking/:playerSlug" element={<PlayerProfilePage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/clubs" element={<ClubsPage />} />
              <Route path="/clubs/:clubSlug" element={<ClubDetailPage />} />
              <Route path="/leagues" element={<LeaguesPage />} />
              <Route path="/leagues/:leagueSlug" element={<LeagueDetailPage />} />
              <Route path="/compare" element={<ComparePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/welcome" element={<WelcomePage />} />
              <Route path="/tournament/:id" element={<TournamentDetailPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/update-password" element={<UpdatePasswordPage />} />
              <Route path="/shop" element={<ShopPage />} />
              <Route path="/sistema-elo" element={<EloSystemPage />} />
              <Route path="/tutorial-csv" element={<TutorialCsvPage />} />
              <Route path="/tools/perfilador-salas" element={<RoomProfilerPage />} />
              <Route path="/academia" element={<AcademyPage />} />
              <Route path="/academia/:moduleSlug" element={<AcademyModulePage />} />
              <Route path="/academia/:moduleSlug/:lessonSlug" element={<AcademyLessonPage />} />
              <Route path="/como-jugar-en-clubgg" element={<TutorialClubGGPage />} />
              {/* Legal */}
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />

              {/* 🛡️ Tools - Sección Blindada */}
<Route path="/tools" element={<ToolsPage />} /> {/* El catálogo sigue siendo público */}

<Route
  path="/tools/quiz"
  element={
    <ProtectedRoute>
      <PokerQuizPage />
    </ProtectedRoute>
  }
/>
<Route
  path="/tools/calculadora-icm"
  element={
    <ProtectedRoute>
      <ICMCalculatorPage />
    </ProtectedRoute>
  }
/>
<Route
  path="/tools/simulador-elo"
  element={
    <ProtectedRoute>
      <EloSimulatorPage />
    </ProtectedRoute>
  }
/>
<Route
  path="/tools/calculadora-banca"
  element={
    <ProtectedRoute>
      <BankrollCalculatorPage />
    </ProtectedRoute>
  }
/>

{/* 🦈 Replayer: Protegemos tanto la ruta con ID como la general */}
<Route
  path="/tools/replayer/h/:id"
  element={
    <ProtectedRoute>
      <ReplayerPage />
    </ProtectedRoute>
  }
/>
<Route
  path="/tools/replayer"
  element={
    <ProtectedRoute>
      <ReplayerPage />
    </ProtectedRoute>
  }
/>

              {/* Blog */}
              <Route path="/blog" element={<BlogPage />} />
              <Route path="/blog/:slug" element={<BlogPostPage />} />
              <Route path="/glosario" element={<GlossaryPage />} />
<Route path="/glosario/:slug" element={<GlossaryTermPage />} />

              {/* Protected */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <PlayerDashboardPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/club"
                element={
                  <ProtectedRoute requiredRole={["club_admin", "super_admin"]}>
                    <ClubAdminPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin"
                element={
                  <ProtectedRoute requiredRole={["super_admin"]}>
                    <SuperAdminPage />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Suspense>

          <FloatingCTA />
        </AuthInitializer>
      </BrowserRouter>
    </QueryClientProvider>
  );
}