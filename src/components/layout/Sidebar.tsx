import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
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
  const { profile, signOut } = useAuth();
  const location = useLocation();
  
  const isDirector = profile?.role === 'cdc_director';

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Profile', href: '/profile', icon: User },
    { name: 'Events', href: '/events', icon: Calendar },
    { name: 'Tasks', href: '/tasks', icon: CheckSquare },
    { name: 'Training', href: '/training', icon: GraduationCap },
    { name: 'Placements', href: '/placements', icon: Building2 },
  ];

  const directorActions = [
    { name: 'Manage Faculty', href: '/faculty', icon: Users },
    { name: 'Create Event', href: '/events/create', icon: Plus },
    { name: 'Create Task', href: '/tasks/create', icon: Plus },
  ];

  return (
    <div className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="bg-pink-600 rounded-lg p-2">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">CDC Portal</h2>
            <p className="text-xs text-gray-500">KPRIET</p>
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
                'relative flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-pink-50 text-pink-700 before:absolute before:left-0 before:top-1 before:bottom-1 before:w-1 before:rounded-r-md before:bg-pink-500'
                  : 'text-gray-900 hover:bg-pink-50 hover:text-pink-700'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive ? 'text-pink-700' : 'text-gray-600')} />
              <span>{item.name}</span>
            </NavLink>
          );
        })}

        {/* Director-only actions */}
        {isDirector && (
          <>
            <div className="pt-4 mt-4 border-t border-gray-200">
              <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Director Actions
              </p>
              {directorActions.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={cn(
                      'relative flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-pink-50 text-pink-700 before:absolute before:left-0 before:top-1 before:bottom-1 before:w-1 before:rounded-r-md before:bg-pink-500'
                        : 'text-gray-900 hover:bg-pink-50 hover:text-pink-700'
                    )}
                  >
                    <item.icon className={cn('h-5 w-5', isActive ? 'text-pink-700' : 'text-gray-600')} />
                    <span>{item.name}</span>
                  </NavLink>
                );
              })}
            </div>
          </>
        )}
      </nav>

      {/* Logout action */}
      <div className="p-4 border-t border-gray-200">
        <Button
          onClick={signOut}
          variant="outline"
          className="w-full justify-center border-pink-200 text-pink-700 hover:bg-pink-50 hover:text-pink-800"
        >
          Log out
        </Button>
      </div>
    </div>
  );
};

export { Sidebar };