import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { StakeholderUser, StakeholderRole, Permission } from '../types/stakeholder';

interface AuthState {
  user: StakeholderUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  mfaRequired: boolean;
  sessionTimeout: Date | null;
}

type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: StakeholderUser }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'MFA_REQUIRED' }
  | { type: 'MFA_VERIFIED' }
  | { type: 'SESSION_TIMEOUT' }
  | { type: 'REFRESH_TOKEN' }
  | { type: 'UPDATE_USER'; payload: Partial<StakeholderUser> };

interface AuthContextType {
  state: AuthState;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  verifyMFA: (code: string) => Promise<void>;
  hasPermission: (resource: string, action: string) => boolean;
  hasRole: (role: StakeholderRole | StakeholderRole[]) => boolean;
  refreshSession: () => Promise<void>;
  logAccess: (resource: string, action: string) => void;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  mfaRequired: false,
  sessionTimeout: null
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, isLoading: true, error: null };
    
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        mfaRequired: false,
        sessionTimeout: new Date(Date.now() + 8 * 60 * 60 * 1000) // 8 hours
      };
    
    case 'LOGIN_FAILURE':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
        mfaRequired: false
      };
    
    case 'LOGOUT':
      return {
        ...initialState,
        isLoading: false
      };
    
    case 'MFA_REQUIRED':
      return { ...state, mfaRequired: true, isLoading: false };
    
    case 'MFA_VERIFIED':
      return { ...state, mfaRequired: false };
    
    case 'SESSION_TIMEOUT':
      return { ...initialState, error: 'Session expired. Please login again.' };
    
    case 'REFRESH_TOKEN':
      return {
        ...state,
        sessionTimeout: new Date(Date.now() + 8 * 60 * 60 * 1000)
      };
    
    case 'UPDATE_USER':
      return {
        ...state,
        user: state.user ? { ...state.user, ...action.payload } : null
      };
    
    default:
      return state;
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Session timeout handler
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (state.sessionTimeout && state.isAuthenticated) {
      const timeUntilTimeout = state.sessionTimeout.getTime() - Date.now();
      
      if (timeUntilTimeout <= 0) {
        dispatch({ type: 'SESSION_TIMEOUT' });
      } else {
        timeoutId = setTimeout(() => {
          dispatch({ type: 'SESSION_TIMEOUT' });
        }, timeUntilTimeout);
      }
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [state.sessionTimeout, state.isAuthenticated]);

  const login = async (email: string, password: string): Promise<void> => {
    dispatch({ type: 'LOGIN_START' });
    
    try {
      // Mock API call - replace with actual authentication service
      const response = await fetch('/api/external/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      if (!response.ok) {
        throw new Error('Authentication failed');
      }
      
      const data = await response.json();
      
      if (data.mfaRequired) {
        dispatch({ type: 'MFA_REQUIRED' });
        return;
      }
      
      // Log the login attempt
      await logAccess('authentication', 'login');
      
      dispatch({ type: 'LOGIN_SUCCESS', payload: data.user });
    } catch (error) {
      dispatch({ 
        type: 'LOGIN_FAILURE', 
        payload: error instanceof Error ? error.message : 'Login failed'
      });
      throw error;
    }
  };

  const logout = (): void => {
    // Log the logout
    logAccess('authentication', 'logout');
    
    // Clear any stored tokens
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    
    dispatch({ type: 'LOGOUT' });
  };

  const verifyMFA = async (code: string): Promise<void> => {
    try {
      const response = await fetch('/api/external/auth/verify-mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      
      if (!response.ok) {
        throw new Error('MFA verification failed');
      }
      
      const data = await response.json();
      
      dispatch({ type: 'MFA_VERIFIED' });
      dispatch({ type: 'LOGIN_SUCCESS', payload: data.user });
    } catch (error) {
      dispatch({ 
        type: 'LOGIN_FAILURE', 
        payload: 'MFA verification failed'
      });
      throw error;
    }
  };

  const hasPermission = (resource: string, action: string): boolean => {
    if (!state.user || !state.isAuthenticated) return false;
    
    return state.user.permissions.some((permission: Permission) => 
      permission.resource === resource && 
      permission.actions.includes(action)
    );
  };

  const hasRole = (role: StakeholderRole | StakeholderRole[]): boolean => {
    if (!state.user || !state.isAuthenticated) return false;
    
    const roles = Array.isArray(role) ? role : [role];
    return roles.includes(state.user.role);
  };

  const refreshSession = async (): Promise<void> => {
    try {
      const response = await fetch('/api/external/auth/refresh', {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        dispatch({ type: 'REFRESH_TOKEN' });
      }
    } catch (error) {
      console.error('Session refresh failed:', error);
    }
  };

  const logAccess = async (resource: string, action: string): Promise<void> => {
    try {
      await fetch('/api/external/auth/log-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: state.user?.id,
          resource,
          action,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          ipAddress: 'client' // Will be determined server-side
        })
      });
    } catch (error) {
      console.error('Access logging failed:', error);
    }
  };

  const value: AuthContextType = {
    state,
    login,
    logout,
    verifyMFA,
    hasPermission,
    hasRole,
    refreshSession,
    logAccess
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}