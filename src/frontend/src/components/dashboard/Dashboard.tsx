import React from 'react';

interface DashboardProps {}

export const Dashboard: React.FC<DashboardProps> = () => {
  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/';
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f9fafb',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <header style={{
        background: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '1rem 2rem'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: '1.5rem', marginRight: '10px' }}>🔐</span>
            <h1 style={{ margin: 0, color: '#1f2937' }}>ESOPFable Dashboard</h1>
          </div>
          <button
            onClick={handleLogout}
            style={{
              background: '#ef4444',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '2rem'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '2rem',
          borderRadius: '12px',
          marginBottom: '2rem',
          textAlign: 'center'
        }}>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '2rem' }}>
            Welcome to Case Management
          </h2>
          <p style={{ margin: '0', opacity: 0.9 }}>
            Secure coordination for complex whistleblower cases
          </p>
        </div>

        {/* Feature Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          <FeatureCard
            icon="👥"
            title="Stakeholder Management"
            description="Track legal teams, witnesses, media contacts, and all case participants"
            status="Available"
          />
          <FeatureCard
            icon="📄"
            title="Document Security"
            description="Encrypted file storage with access logging and version control"
            status="Available"
          />
          <FeatureCard
            icon="🔍"
            title="Evidence Chain"
            description="Maintain custody and integrity verification for all evidence"
            status="Available"
          />
          <FeatureCard
            icon="💬"
            title="Communication Hub"
            description="Log all interactions, meetings, and correspondence"
            status="Available"
          />
          <FeatureCard
            icon="🛡️"
            title="Risk Monitoring"
            description="Track threats, retaliation indicators, and safety concerns"
            status="Available"
          />
          <FeatureCard
            icon="⚡"
            title="Real-time Updates"
            description="Live collaboration with automatic updates across team members"
            status="Active"
          />
        </div>

        {/* Quick Actions */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#374151' }}>Quick Actions</h3>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <ActionButton href="/stakeholders" label="Add Stakeholder" />
            <ActionButton href="/documents" label="Upload Document" />
            <ActionButton href="/communications" label="Log Communication" />
            <ActionButton href="/evidence" label="Add Evidence" />
            <ActionButton href="http://localhost:3001/api-docs" label="View API Docs" external />
            <ActionButton href="http://localhost:3001/health" label="System Health" external />
          </div>
        </div>
      </main>
    </div>
  );
};

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
  status: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description, status }) => (
  <div style={{
    background: 'white',
    borderRadius: '8px',
    padding: '1.5rem',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
      <span style={{ fontSize: '1.5rem', marginRight: '10px' }}>{icon}</span>
      <h3 style={{ margin: 0, color: '#1f2937' }}>{title}</h3>
    </div>
    <p style={{ color: '#6b7280', marginBottom: '1rem', fontSize: '14px' }}>
      {description}
    </p>
    <div style={{
      display: 'inline-block',
      background: status === 'Active' ? '#10b981' : '#3b82f6',
      color: 'white',
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '12px'
    }}>
      {status}
    </div>
  </div>
);

interface ActionButtonProps {
  href: string;
  label: string;
  external?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({ href, label, external }) => (
  <a
    href={href}
    target={external ? '_blank' : '_self'}
    rel={external ? 'noopener noreferrer' : undefined}
    style={{
      display: 'inline-block',
      background: '#667eea',
      color: 'white',
      textDecoration: 'none',
      padding: '10px 20px',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: '500'
    }}
  >
    {label}
  </a>
);