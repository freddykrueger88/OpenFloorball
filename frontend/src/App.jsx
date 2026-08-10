import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import useAuthStore from './store/authStore.js';
import { apiFetch } from './utils/apiFetch.js';
import { applyGlobalPreferences } from './utils/applyPreferences.js';
import ErrorBoundary from './components/layout/ErrorBoundary.jsx';
import ColorBlindFilters from './components/a11y/ColorBlindFilters.jsx';
import LiveRegion from './components/a11y/LiveRegion.jsx';
import Header from './components/layout/Header.jsx';
import Footer from './components/layout/Footer.jsx';
import OfflineBanner from './components/layout/OfflineBanner.jsx';
import TourOverlay from './components/layout/TourOverlay.jsx';
import useOfflineStore from './store/offlineStore.js';
import { syncOfflineQueue } from './utils/offlineSync.js';
import { getQueueCounts } from './utils/offlineQueue.js';
import { NAV_TOUR_STEPS } from './constants/tourSteps.js';
import './styles/tokens.css';
import './styles/base.css';
import './styles/auth.css';
import '@fontsource/opendyslexic/400.css';
import '@fontsource/opendyslexic/700.css';
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/700.css';

const LoginPage      = lazy(() => import('./pages/LoginPage.jsx'));
const RegisterPage   = lazy(() => import('./pages/RegisterPage.jsx'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage.jsx'));
const ResetPasswordPage  = lazy(() => import('./pages/ResetPasswordPage.jsx'));
const BoardsPage     = lazy(() => import('./pages/BoardsPage.jsx'));
const BoardEditorPage = lazy(() => import('./pages/BoardEditorPage.jsx'));
const TrainingsPage       = lazy(() => import('./pages/TrainingsPage.jsx'));
const TrainingSessionPage = lazy(() => import('./pages/TrainingSessionPage.jsx'));
const RosterPage          = lazy(() => import('./pages/RosterPage.jsx'));
const GamesPage           = lazy(() => import('./pages/GamesPage.jsx'));
const GamePage            = lazy(() => import('./pages/GamePage.jsx'));
const StatsPage           = lazy(() => import('./pages/StatsPage.jsx'));
const OrganizationPage    = lazy(() => import('./pages/OrganizationPage.jsx'));
const CalendarPage        = lazy(() => import('./pages/CalendarPage.jsx'));
const NewsPage            = lazy(() => import('./pages/NewsPage.jsx'));
const PollsPage           = lazy(() => import('./pages/PollsPage.jsx'));
const LinesPage           = lazy(() => import('./pages/LinesPage.jsx'));
const LibraryPage         = lazy(() => import('./pages/LibraryPage.jsx'));
const KnowledgePage       = lazy(() => import('./pages/KnowledgePage.jsx'));
const SharePage       = lazy(() => import('./pages/SharePage.jsx'));
const InvitePage      = lazy(() => import('./pages/InvitePage.jsx'));
const SettingsPage    = lazy(() => import('./pages/SettingsPage.jsx'));
const PrivacyPage     = lazy(() => import('./pages/PrivacyPage.jsx'));
const RulesPage       = lazy(() => import('./pages/RulesPage.jsx'));
const NotFound       = lazy(() => import('./pages/NotFound.jsx'));

function PrivateRoute({ children }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function PublicRoute({ children }) {
  const user = useAuthStore((s) => s.user);
  if (user) return <Navigate to="/boards" replace />;
  return children;
}

const Loader = () => {
  const { t } = useTranslation();
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <span className="sr-only">{t('settings.loadingPage')}</span>
      <div className="spinner" aria-hidden="true" />
    </div>
  );
};

export default function App() {
  const user = useAuthStore((s) => s.user);
  const [booted, setBooted] = useState(false);

  // Sitzung anhand des HttpOnly-Cookies wiederherstellen (fetchMe() wurde
  // bisher nirgends aufgerufen – jeder Seiten-Reload hat dadurch visuell
  // ausgeloggt, obwohl das Cookie noch gültig war)
  useEffect(() => {
    useAuthStore.getState().fetchMe().finally(() => setBooted(true));
  }, []);

  // Globale Darstellungs-/Barrierefreiheits-Einstellungen laden, sobald
  // eine Session besteht (Issue #18)
  useEffect(() => {
    if (!user) return;
    apiFetch('/api/settings').then(applyGlobalPreferences).catch(() => {});
  }, [user]);

  // Issue #49 – Offline-Modus: online/offline-Events global registrieren,
  // bei Wiederverbindung gepufferte Schreibzugriffe automatisch abspielen.
  // Initialen Queue-Stand einmalig laden (z.B. nach Reload mit noch
  // offenen, nicht synchronisierten Änderungen).
  useEffect(() => {
    const handleOnline = () => {
      useOfflineStore.getState().setOnline(true);
      syncOfflineQueue();
    };
    const handleOffline = () => useOfflineStore.getState().setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    getQueueCounts().then(({ pending, conflict }) => {
      useOfflineStore.getState().setQueueLength(pending);
      useOfflineStore.getState().setConflictCount(conflict);
    });
    if (navigator.onLine) syncOfflineQueue();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!booted) return <Loader />;

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ColorBlindFilters />
        <LiveRegion />
        <OfflineBanner />
        <Header />
        {user && <TourOverlay tourId="nav" steps={NAV_TOUR_STEPS} settingsKey="tourCompleted" />}
        <Suspense fallback={<Loader />}>
          <Routes>
            <Route path="/" element={<Navigate to="/boards" replace />} />
            <Route path="/login"    element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
            <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
            <Route path="/reset-password/:token" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />
            <Route path="/boards" element={<PrivateRoute><BoardsPage /></PrivateRoute>} />
            <Route path="/board/:id" element={<PrivateRoute><BoardEditorPage /></PrivateRoute>} />
            <Route path="/trainings" element={<PrivateRoute><TrainingsPage /></PrivateRoute>} />
            <Route path="/trainings/:id" element={<PrivateRoute><TrainingSessionPage /></PrivateRoute>} />
            <Route path="/games" element={<PrivateRoute><GamesPage /></PrivateRoute>} />
            <Route path="/games/:id" element={<PrivateRoute><GamePage /></PrivateRoute>} />
            <Route path="/stats" element={<PrivateRoute><StatsPage /></PrivateRoute>} />
            <Route path="/calendar" element={<PrivateRoute><CalendarPage /></PrivateRoute>} />
            <Route path="/news" element={<PrivateRoute><NewsPage /></PrivateRoute>} />
            <Route path="/polls" element={<PrivateRoute><PollsPage /></PrivateRoute>} />
            <Route path="/lines" element={<PrivateRoute><LinesPage /></PrivateRoute>} />
            <Route path="/roster" element={<PrivateRoute><RosterPage /></PrivateRoute>} />
            <Route path="/library" element={<PrivateRoute><LibraryPage /></PrivateRoute>} />
            <Route path="/knowledge" element={<PrivateRoute><KnowledgePage /></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
            <Route path="/organizations/:id" element={<PrivateRoute><OrganizationPage /></PrivateRoute>} />
            <Route path="/share/:token" element={<SharePage />} />
            <Route path="/invite/:token" element={<InvitePage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/rules" element={<RulesPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <Footer />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
