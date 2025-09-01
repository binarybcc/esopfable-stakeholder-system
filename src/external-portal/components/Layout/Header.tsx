import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { StakeholderUser, StakeholderRole } from '../../types/stakeholder';

interface HeaderProps {
  user: StakeholderUser | null;
  onMobileMenuToggle: () => void;
}

export default function Header({ user, onMobileMenuToggle }: HeaderProps) {
  const { logout, logAccess } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [sessionWarning, setSessionWarning] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logAccess('authentication', 'logout');
    logout();
  };

  const getRoleBadgeColor = (role: StakeholderRole) => {
    switch (role) {
      case StakeholderRole.ESOP_PARTICIPANT:
        return 'bg-blue-100 text-blue-800';
      case StakeholderRole.GOVERNMENT_ENTITY:
        return 'bg-green-100 text-green-800';
      case StakeholderRole.MEDIA_CONTACT:
        return 'bg-purple-100 text-purple-800';
      case StakeholderRole.KEY_WITNESS:
        return 'bg-red-100 text-red-800';
      case StakeholderRole.OPPOSITION:
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleDisplayName = (role: StakeholderRole) => {
    switch (role) {
      case StakeholderRole.ESOP_PARTICIPANT:
        return 'ESOP Participant';
      case StakeholderRole.GOVERNMENT_ENTITY:
        return 'Government Entity';
      case StakeholderRole.MEDIA_CONTACT:
        return 'Media Contact';
      case StakeholderRole.KEY_WITNESS:
        return 'Key Witness';
      case StakeholderRole.OPPOSITION:
        return 'Opposition';
      default:
        return 'Public User';
    }
  };

  return (
    <>
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Mobile menu button */}
            <button
              type="button"
              className="lg:hidden -ml-2 p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={onMobileMenuToggle}
              aria-label="Open mobile menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            {/* Logo and title */}
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <div className="h-8 w-8 bg-blue-600 rounded-md flex items-center justify-center">
                  <span className="text-white font-bold text-sm">ES</span>
                </div>
                <h1 className="ml-3 text-xl font-semibold text-gray-900 hidden sm:block">
                  ESOP Stakeholder Portal
                </h1>
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center space-x-4">
              {/* Security indicator */}
              <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-600">
                <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                <span className="text-xs">Secure Session</span>
              </div>

              {/* User menu */}
              {user && (
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    className="flex items-center space-x-3 p-1.5 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    aria-expanded={isUserMenuOpen}
                    aria-haspopup="true"
                  >
                    <div className="flex items-center space-x-3">
                      {/* User avatar */}
                      <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                        <span className="text-sm font-medium text-white">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      
                      {/* User info */}
                      <div className="hidden md:block text-left">
                        <div className="text-sm font-medium text-gray-900 truncate max-w-32">
                          {user.name}
                        </div>
                        <div className="text-xs text-gray-600 truncate max-w-32">
                          {user.organization || user.email}
                        </div>
                      </div>

                      {/* Role badge */}
                      <span className={`hidden sm:inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(user.role)}`}>
                        {getRoleDisplayName(user.role)}
                      </span>

                      {/* Dropdown arrow */}
                      <svg className="h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </button>

                  {/* User dropdown menu */}
                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                      <div className="py-1" role="menu" aria-orientation="vertical">
                        {/* User info section */}
                        <div className="px-4 py-3 border-b border-gray-100">
                          <div className="flex items-center space-x-3">
                            <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                              <span className="text-lg font-medium text-white">
                                {user.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {user.name}
                              </p>
                              <p className="text-xs text-gray-600 truncate">
                                {user.email}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {getRoleDisplayName(user.role)}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Menu items */}
                        <div className="py-1">
                          <button
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:bg-gray-50"
                            role="menuitem"
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              // Navigate to profile
                            }}
                          >
                            <div className="flex items-center">
                              <svg className="mr-3 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                              </svg>
                              Profile Settings
                            </div>
                          </button>

                          <button
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:bg-gray-50"
                            role="menuitem"
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              // Navigate to security settings
                            }}
                          >
                            <div className="flex items-center">
                              <svg className="mr-3 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.623 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                              </svg>
                              Security Settings
                            </div>
                          </button>

                          <hr className="my-1" />

                          <button
                            className="block w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50 focus:outline-none focus:bg-red-50"
                            role="menuitem"
                            onClick={handleLogout}
                          >
                            <div className="flex items-center">
                              <svg className="mr-3 h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                              </svg>
                              Sign Out
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Session warning banner */}
      {sessionWarning && (
        <div className="bg-yellow-50 border-b border-yellow-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-yellow-800">
                  Your session will expire soon. Please save your work.
                </p>
              </div>
              <button
                className="text-yellow-800 hover:text-yellow-900 text-sm underline"
                onClick={() => setSessionWarning(false)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}