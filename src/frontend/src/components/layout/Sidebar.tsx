import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  Users,
  FileText,
  Calendar,
  MessageSquare,
  Shield,
  AlertTriangle,
  Megaphone,
  BarChart3,
  Search,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/utils';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggleCollapse }) => {
  const location = useLocation();

  const navigationItems = [
    { path: '/', icon: Home, label: 'Dashboard', exact: true },
    { path: '/stakeholders', icon: Users, label: 'Stakeholders' },
    { path: '/documents', icon: FileText, label: 'Documents' },
    { path: '/tasks', icon: Calendar, label: 'Tasks & Timeline' },
    { path: '/communications', icon: MessageSquare, label: 'Communications' },
    { path: '/evidence', icon: Shield, label: 'Evidence Chain' },
    { path: '/risk', icon: AlertTriangle, label: 'Risk Monitoring' },
    { path: '/pr-messages', icon: Megaphone, label: 'PR Messages' },
    { path: '/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/search', icon: Search, label: 'Advanced Search' },
  ];

  const secondaryItems = [
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  const isActive = (path: string, exact = false) => {
    return exact ? location.pathname === path : location.pathname.startsWith(path);
  };

  return (
    <div
      className={cn(
        'bg-gray-900 text-white h-full flex flex-col transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <h1 className="text-xl font-bold text-white">ESOPfable Legal</h1>
          )}
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded-lg hover:bg-gray-800 transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path, item.exact);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                'hover:bg-gray-800 hover:text-white',
                active
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-300 hover:text-white'
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={cn('w-5 h-5', !collapsed && 'mr-3')} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Secondary Navigation */}
      <div className="p-4 border-t border-gray-800">
        {secondaryItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                'hover:bg-gray-800 hover:text-white',
                active
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-300 hover:text-white'
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={cn('w-5 h-5', !collapsed && 'mr-3')} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </div>

      {/* User Info */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium">JD</span>
          </div>
          {!collapsed && (
            <div className="ml-3">
              <p className="text-sm font-medium text-white">John Doe</p>
              <p className="text-xs text-gray-400">Legal Team</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;