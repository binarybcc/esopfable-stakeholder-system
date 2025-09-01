import React, { useState } from 'react';
import { Bell, Search, Moon, Sun, Menu } from 'lucide-react';
import { Button, Input, Badge } from '@/components/ui';
import { cn } from '@/utils';
import { useTheme } from '@/contexts/ThemeContext';
import NotificationDropdown from './NotificationDropdown';

interface HeaderProps {
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
}

const Header: React.FC<HeaderProps> = ({ onToggleSidebar, sidebarCollapsed }) => {
  const { theme, toggleTheme } = useTheme();
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Navigate to search page with query
      console.log('Searching for:', searchQuery);
    }
  };

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left Section */}
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleSidebar}
              className="lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </Button>

            {/* Search */}
            <form onSubmit={handleSearch} className="hidden md:block">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search cases, documents, stakeholders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  startIcon={<Search className="w-4 h-4" />}
                  className="w-96"
                />
              </div>
            </form>
          </div>

          {/* Right Section */}
          <div className="flex items-center space-x-3">
            {/* Quick Stats */}
            <div className="hidden lg:flex items-center space-x-4 mr-6">
              <div className="text-center">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  23
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Open Tasks
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  8
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Risk Events
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  156
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Documents
                </div>
              </div>
            </div>

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </Button>

            {/* Notifications */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNotifications(!showNotifications)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 relative"
              >
                <Bell className="w-5 h-5" />
                <Badge
                  variant="danger"
                  size="sm"
                  className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center text-xs"
                >
                  3
                </Badge>
              </Button>

              <NotificationDropdown
                isOpen={showNotifications}
                onClose={() => setShowNotifications(false)}
              />
            </div>

            {/* User Menu */}
            <div className="flex items-center">
              <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-white">JD</span>
              </div>
              <div className="ml-2 hidden md:block">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  John Doe
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Legal Team Lead
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;