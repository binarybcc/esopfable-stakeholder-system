import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useRoleBasedContent } from '../../hooks/useRoleBasedContent';
import { StakeholderRole } from '../../types/stakeholder';
import Navigation from './Navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileMenu from './MobileMenu';
import AccessibilityControls from '../Accessibility/AccessibilityControls';
import LoadingSpinner from '../Common/LoadingSpinner';
import ErrorBoundary from '../Common/ErrorBoundary';

// Import role-specific dashboards
import ESOPParticipantDashboard from '../Dashboards/ESOPParticipantDashboard';
import GovernmentEntityDashboard from '../Dashboards/GovernmentEntityDashboard';
import MediaContactDashboard from '../Dashboards/MediaContactDashboard';
import KeyWitnessDashboard from '../Dashboards/KeyWitnessDashboard';
import OppositionDashboard from '../Dashboards/OppositionDashboard';
import PublicDashboard from '../Dashboards/PublicDashboard';
import LoginPage from '../Auth/LoginPage';
import MFAVerification from '../Auth/MFAVerification';

interface AppLayoutProps {
  children?: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { state, refreshSession } = useAuth();
  const { navigationItems, featureFlags } = useRoleBasedContent();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize session and check authentication
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        await refreshSession();
      } catch (error) {
        console.error('Session initialization failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [refreshSession]);

  // Handle session timeout warnings
  useEffect(() => {
    if (state.sessionTimeout && state.isAuthenticated) {
      const timeUntilWarning = state.sessionTimeout.getTime() - Date.now() - (15 * 60 * 1000); // 15 mins before timeout
      
      if (timeUntilWarning > 0) {
        const warningTimeout = setTimeout(() => {
          // Show session timeout warning
          const shouldExtend = window.confirm(
            'Your session will expire in 15 minutes. Would you like to extend it?'
          );
          if (shouldExtend) {
            refreshSession();
          }
        }, timeUntilWarning);

        return () => clearTimeout(warningTimeout);
      }
    }
  }, [state.sessionTimeout, state.isAuthenticated, refreshSession]);

  // Redirect based on authentication status
  useEffect(() => {
    if (!isLoading) {
      if (!state.isAuthenticated && location.pathname !== '/login') {
        navigate('/login');
      } else if (state.isAuthenticated && location.pathname === '/login') {
        navigate('/dashboard');
      }
    }
  }, [state.isAuthenticated, isLoading, location.pathname, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  // Show login page if not authenticated
  if (!state.isAuthenticated) {
    if (state.mfaRequired) {
      return <MFAVerification />;
    }
    return <LoginPage />;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 flex">
        {/* Accessibility controls */}
        <AccessibilityControls />
        
        {/* Sidebar for desktop */}
        <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0">
          <Sidebar 
            navigationItems={navigationItems}
            featureFlags={featureFlags}
            userRole={state.user?.role}
          />
        </div>

        {/* Mobile menu */}
        <MobileMenu
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          navigationItems={navigationItems}
          featureFlags={featureFlags}
          userRole={state.user?.role}
        />

        {/* Main content area */}
        <div className="flex-1 lg:pl-64">
          {/* Header */}
          <Header
            user={state.user}
            onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          />

          {/* Page content */}
          <main className="py-6 px-4 sm:px-6 lg:px-8">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardRouter userRole={state.user?.role} />} />
              <Route path="/login" element={<Navigate to="/dashboard" replace />} />
              
              {/* Role-specific routes will be defined in each dashboard component */}
              <Route path="/*" element={<DashboardRouter userRole={state.user?.role} />} />
            </Routes>
            {children}
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}

interface DashboardRouterProps {
  userRole?: StakeholderRole;
}

function DashboardRouter({ userRole }: DashboardRouterProps) {
  switch (userRole) {
    case StakeholderRole.ESOP_PARTICIPANT:
      return <ESOPParticipantDashboard />;
    
    case StakeholderRole.GOVERNMENT_ENTITY:
      return <GovernmentEntityDashboard />;
    
    case StakeholderRole.MEDIA_CONTACT:
      return <MediaContactDashboard />;
    
    case StakeholderRole.KEY_WITNESS:
      return <KeyWitnessDashboard />;
    
    case StakeholderRole.OPPOSITION:
      return <OppositionDashboard />;
    
    case StakeholderRole.PUBLIC:
    default:
      return <PublicDashboard />;
  }
}