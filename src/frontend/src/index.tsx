import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { LoginPage } from './components/auth/LoginPage';
import { Dashboard } from './components/dashboard/Dashboard';
import StakeholderDashboard from './components/stakeholders/StakeholderDashboard';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    if (token) {
      // In a real app, you'd verify the token with the backend
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  // Handle URL-based navigation
  const currentPath = window.location.pathname;
  
  if (currentPath === '/dashboard' && !isAuthenticated) {
    window.location.href = '/';
    return null;
  }

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f9fafb'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔐</div>
          <div style={{ color: '#6b7280' }}>Loading ESOPFable...</div>
        </div>
      </div>
    );
  }

  // Route handling
  if (currentPath === '/stakeholders' && isAuthenticated) {
    return <StakeholderDashboard />;
  }
  
  if (currentPath === '/dashboard' || isAuthenticated) {
    return <Dashboard />;
  }

  return <LoginPage />;
};

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(<App />);