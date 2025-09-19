import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import FirstTimePasswordChange from '@/components/auth/FirstTimePasswordChange';

const DashboardLayout = () => {
  const { user, profile, loading, needsPasswordChange } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Show password change screen for first-time faculty users
  if (needsPasswordChange) {
    return <FirstTimePasswordChange />;
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div className="flex">
        <Sidebar />
        <div className="flex-1 flex flex-col min-h-screen ml-64">
          <TopNav />
          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="container mx-auto p-6 max-w-full">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;