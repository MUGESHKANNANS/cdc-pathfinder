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
  Plus,
  Settings,
  Shield,
  UserCheck,
  BarChart3,
  List
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

  const careerLinks = [
    { name: 'Student List', href: '/career-students' },
    { name: 'All Analysis', href: '/career/all-analysis' },
    { name: 'Company Wise', href: '/career/company-analysis' },
    { name: 'Batch Analysis', href: '/career/batch-analysis' },
    { name: 'Placement Offers', href: '/career/placement-offer-analysis' },
    { name: 'Gender Analysis', href: '/career/gender-analysis' },
    { name: 'Quota Analysis', href: '/career/quota-analysis' },
    { name: 'Hostel/Day Scholar', href: '/career/hostel-day-scholar-analysis' },
  ];

  const directorActions = [
    { name: 'Manage Faculty', href: '/faculty', icon: Users },
    { name: 'Faculty Directory', href: '/faculty/directory', icon: UserCheck },
    { name: 'Create Event', href: '/events/create', icon: Plus },
    { name: 'Create Task', href: '/tasks/create', icon: Plus },
    { name: 'Create Training', href: '/training/create', icon: Plus },
    { name: 'System Settings', href: '/settings', icon: Settings },
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
              {isDirector && (
                <div className="flex items-center mt-1">
                  <Shield className="h-3 w-3 text-pink-600 mr-1" />
                  <span className="text-xs text-pink-600 font-medium">SuperAdmin</span>
                </div>
              )}
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

        {/* Career Section */}
        <div className="pt-4 mt-4 border-t border-gray-200">
          <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Career
          </p>
          <NavLink
            to={'/career/main-dashboard'}
            className={cn(
              'relative flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
              location.pathname === '/career/main-dashboard'
                ? 'bg-pink-50 text-pink-700 before:absolute before:left-0 before:top-1 before:bottom-1 before:w-1 before:rounded-r-md before:bg-pink-500'
                : 'text-gray-900 hover:bg-pink-50 hover:text-pink-700'
            )}
          >
            <BarChart3 className={cn('h-5 w-5', location.pathname === '/career/main-dashboard' ? 'text-pink-700' : 'text-gray-600')} />
            <span>All Charts</span>
          </NavLink>
          {careerLinks.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={cn(
                  'ml-8 relative flex items-center space-x-3 px-3 py-2 rounded-xl text-sm transition-all duration-200',
                  isActive ? 'text-pink-700' : 'text-gray-700 hover:text-pink-700'
                )}
              >
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </div>

        {/* Director-only actions */}
        {isDirector && (
          <>
            <div className="pt-4 mt-4 border-t border-gray-200">
              <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                SuperAdmin Actions
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