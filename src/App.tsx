import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { HeroPage } from './pages/HeroPage';
import { ClaimPage } from './pages/ClaimPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { NewPayoutPage } from './pages/NewPayoutPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HeroPage />} />
        <Route path="/claim/:id" element={<ClaimPage />} />
        <Route path="/claim" element={<Navigate to="/claim/demo" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/payouts/new" element={<NewPayoutPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
