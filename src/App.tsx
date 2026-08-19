import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { HeroPage } from './pages/HeroPage';
import { ClaimPage } from './pages/ClaimPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { NewPayoutPage } from './pages/NewPayoutPage';
import { CampaignDetailPage } from './pages/CampaignDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { DocsPage } from './pages/DocsPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ToastContainer } from './components/ToastContainer';
import { useAuthStore } from '@/stores/auth.store';
import { initWalletKit } from '@/lib/stellar/wallet-kit';

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
      <ToastContainer />
    </Router>
  );
}
