import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { HeroPage } from './pages/HeroPage';
import { LoginPage } from './pages/LoginPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ToastContainer } from './components/ToastContainer';
import { useAuthStore } from '@/stores/auth.store';
import { initWalletKit } from '@/lib/stellar/wallet-kit';

// Heavy pages are lazy-loaded so the initial bundle stays small.
// Vite automatically code-splits these into separate chunks.
const ClaimPage = lazy(() => import('./pages/ClaimPage').then(m => ({ default: m.ClaimPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const NewPayoutPage = lazy(() => import('./pages/NewPayoutPage').then(m => ({ default: m.NewPayoutPage })));
const CampaignDetailPage = lazy(() => import('./pages/CampaignDetailPage').then(m => ({ default: m.CampaignDetailPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const DocsPage = lazy(() => import('./pages/DocsPage').then(m => ({ default: m.DocsPage })));

function PageLoader() {
  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        <span className="text-white/40 text-sm font-medium">Loading…</span>
      </div>
    </div>
  );
}

export default function App() {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    initWalletKit();
  }, []);

  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<HeroPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/claim/:id" element={<ClaimPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/campaigns/new" element={<ProtectedRoute><NewPayoutPage /></ProtectedRoute>} />
          <Route path="/payouts/new" element={<Navigate to="/campaigns/new" replace />} />
          <Route path="/campaigns/:id" element={<ProtectedRoute><CampaignDetailPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <ToastContainer />
    </Router>
  );
}

