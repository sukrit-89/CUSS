import React, { Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';

const Dashboard = React.lazy(() => import('@/features/dashboard/components/Dashboard'));
const CampaignList = React.lazy(() => import('@/features/campaigns/components/CampaignList'));
const CampaignForm = React.lazy(() => import('@/features/campaigns/components/CampaignForm'));
const CampaignDetail = React.lazy(() => import('@/features/campaigns/components/CampaignDetail'));
const ClaimPage = React.lazy(() => import('@/features/claims/components/ClaimPage'));
const LoginPage = React.lazy(() => import('@/features/auth/components/LoginButton'));
const Layout = React.lazy(() => import('@/shared/components/Layout'));
const LoadingSpinner = React.lazy(() => import('@/shared/components/LoadingSpinner'));

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return <Suspense fallback={<div>Loading...</div>}><LoadingSpinner /></Suspense>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Suspense fallback={<div>Loading...</div>}><LoginPage /></Suspense>
  },
  {
    path: '/claim/:token',
    element: <Suspense fallback={<div>Loading...</div>}><ClaimPage /></Suspense>
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Suspense fallback={<div>Loading...</div>}>
          <Layout />
        </Suspense>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Suspense fallback={<div>Loading...</div>}><Dashboard /></Suspense> },
      { path: 'campaigns', element: <Suspense fallback={<div>Loading...</div>}><CampaignList /></Suspense> },
      { path: 'campaigns/new', element: <Suspense fallback={<div>Loading...</div>}><CampaignForm /></Suspense> },
      { path: 'campaigns/:id', element: <Suspense fallback={<div>Loading...</div>}><CampaignDetail /></Suspense> }
    ]
  }
]);