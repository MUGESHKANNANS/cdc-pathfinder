import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  User, 
  Calendar, 
  CheckSquare, 
  GraduationCap, 
  Building2,
  Users,
  Plus
} from 'lucide-react';

const Sidebar = () => {
  const { profile } = useAuth();
  const location = useLocation();
  
  const isDirector = profile?.role === 'cdc_director';

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, color: 'text-blue-500' },
    { name: 'Profile', href: '/profile', icon: User, color: 'text-green-500' },
    { name: 'Events', href: '/events', icon: Calendar, color: 'text-purple-500' },
    { name: 'Tasks', href: '/tasks', icon: CheckSquare, color: 'text-orange-500' },
    { name: 'Training', href: '/training', icon: GraduationCap, color: 'text-indigo-500' },
    { name: 'Placements', href: '/placements', icon: Building2, color: 'text-red-500' },
  ];

  const directorActions = [
    { name: 'Manage Faculty', href: '/faculty', icon: Users, color: 'text-cyan-500' },
    { name: 'Create Event', href: '/events/create', icon: Plus, color: 'text-emerald-500' },
    { name: 'Create Task', href: '/tasks/create', icon: Plus, color: 'text-amber-500' },
  ];

  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center space-x-3">
          <div className="bg-sidebar-primary rounded-lg p-2">
            <GraduationCap className="h-6 w-6 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h2 className="font-bold text-sidebar-foreground">CDC Portal</h2>
            <p className="text-xs text-sidebar-foreground/70">KPRIET</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={cn(
                'flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive ? 'text-current' : item.color)} />
              <span>{item.name}</span>
            </NavLink>
          );
        })}

        {/* Director-only actions */}
        {isDirector && (
          <>
            <div className="pt-4 mt-4 border-t border-sidebar-border">
              <p className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">
                Director Actions
              </p>
              {directorActions.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={cn(
                      'flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <item.icon className={cn('h-5 w-5', isActive ? 'text-current' : item.color)} />
                    <span>{item.name}</span>
                  </NavLink>
                );
              })}
            </div>
          </>
        )}
      </nav>

      {/* User info */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-sidebar-accent rounded-full flex items-center justify-center">
            <User className="h-4 w-4 text-sidebar-accent-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {profile?.name || 'User'}
            </p>
            <p className="text-xs text-sidebar-foreground/70 capitalize">
              {profile?.role?.replace('_', ' ')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export { Sidebar };