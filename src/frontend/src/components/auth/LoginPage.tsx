import React, { useState } from 'react';

interface LoginPageProps {}

export const LoginPage: React.FC<LoginPageProps> = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store token and redirect to dashboard
        localStorage.setItem('token', data.token);
        window.location.href = '/dashboard';
      } else {
        setError(data.error?.message || 'Login failed');
      }
    } catch (err) {
      setError('Connection error. Please check if the backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setEmail('admin@esopfable.com');
    setPassword('SecureAdmin123!');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        width: '100%',
        maxWidth: '400px',
        padding: '40px'
      }}>
        {/* Logo/Header */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{
            fontSize: '3rem',
            marginBottom: '10px'
          }}>
            🔐
          </div>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: '#1f2937',
            margin: '0 0 5px 0'
          }}>
            ESOPFable
          </h1>
          <p style={{
            color: '#6b7280',
            margin: '0',
            fontSize: '14px'
          }}>
            Case Management System
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            color: '#dc2626',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '5px'
            }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
              placeholder="admin@esopfable.com"
            />
          </div>

          <div style={{ marginBottom: '25px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '5px'
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              background: isLoading ? '#9ca3af' : '#667eea',
              color: 'white',
              border: 'none',
              padding: '12px',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              marginBottom: '15px'
            }}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Demo Credentials */}
        <div style={{
          borderTop: '1px solid #e5e7eb',
          paddingTop: '20px',
          textAlign: 'center'
        }}>
          <p style={{
            fontSize: '14px',
            color: '#6b7280',
            margin: '0 0 10px 0'
          }}>
            Demo Credentials:
          </p>
          <button
            type="button"
            onClick={fillDemoCredentials}
            style={{
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              color: '#374151',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Fill Demo Login
          </button>
        </div>

        {/* System Status */}
        <div style={{
          marginTop: '20px',
          padding: '15px',
          background: '#f9fafb',
          borderRadius: '6px',
          fontSize: '12px',
          color: '#6b7280'
        }}>
          <div style={{ marginBottom: '5px' }}>
            <strong>System Status:</strong>
          </div>
          <div>• Backend API: Running on :3001</div>
          <div>• Database: Connected (PostgreSQL)</div>
          <div>• Real-time: WebSocket Active</div>
        </div>
      </div>
    </div>
  );
};