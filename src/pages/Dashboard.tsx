import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, 
  Calendar, 
  CheckSquare, 
  GraduationCap, 
  Building2, 
  Plus,
  Clock,
  TrendingUp,
  AlertCircle,
  Shield,
  Settings,
  Activity
} from 'lucide-react';

interface DashboardStats {
  totalFaculty: number;
  totalEvents: number;
  totalTasks: number;
  pendingTasks: number;
  completedTasks: number;
  upcomingEvents: number;
}

const Dashboard = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalFaculty: 0,
    totalEvents: 0,
    totalTasks: 0,
    pendingTasks: 0,
    completedTasks: 0,
    upcomingEvents: 0
  });

  const isDirector = profile?.role === 'cdc_director';

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch different stats based on role
        if (isDirector) {
          // Director sees all stats
          const [facultyResult, eventsResult, tasksResult] = await Promise.all([
            supabase.from('profiles').select('*', { count: 'exact' }).eq('role', 'faculty'),
            supabase.from('events').select('*', { count: 'exact' }),
            supabase.from('tasks').select('*', { count: 'exact' })
          ]);

          const pendingTasks = await supabase
            .from('tasks')
            .select('*', { count: 'exact' })
            .eq('status', 'pending');

          const completedTasks = await supabase
            .from('tasks')
            .select('*', { count: 'exact' })
            .eq('status', 'completed');

          const upcomingEvents = await supabase
            .from('events')
            .select('*', { count: 'exact' })
            .gte('event_date', new Date().toISOString().split('T')[0]);

          setStats({
            totalFaculty: facultyResult.count || 0,
            totalEvents: eventsResult.count || 0,
            totalTasks: tasksResult.count || 0,
            pendingTasks: pendingTasks.count || 0,
            completedTasks: completedTasks.count || 0,
            upcomingEvents: upcomingEvents.count || 0
          });
        } else {
          // Faculty sees only their stats
          const [myTasksResult, myEventsResult] = await Promise.all([
            supabase.from('tasks').select('*', { count: 'exact' }).eq('assigned_to', profile?.user_id),
            supabase.from('event_assignments').select('*, events(*)', { count: 'exact' }).eq('faculty_id', profile?.user_id)
          ]);

          const myPendingTasks = await supabase
            .from('tasks')
            .select('*', { count: 'exact' })
            .eq('assigned_to', profile?.user_id)
            .eq('status', 'pending');

          const myCompletedTasks = await supabase
            .from('tasks')
            .select('*', { count: 'exact' })
            .eq('assigned_to', profile?.user_id)
            .eq('status', 'completed');

          setStats({
            totalFaculty: 0,
            totalEvents: 0,
            totalTasks: myTasksResult.count || 0,
            pendingTasks: myPendingTasks.count || 0,
            completedTasks: myCompletedTasks.count || 0,
            upcomingEvents: myEventsResult.count || 0
          });
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    if (profile) {
      fetchStats();
    }
  }, [profile, isDirector]);

  const StatCard = ({ title, value, icon: Icon, color, description }: {
    title: string;
    value: number;
    icon: any;
    color: string;
    description?: string;
  }) => (
    <Card className="transition-all duration-200 hover:shadow-md h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );

  const QuickAction = ({ title, description, icon: Icon, onClick, color }: {
    title: string;
    description: string;
    icon: any;
    onClick: () => void;
    color: string;
  }) => (
    <Card className="cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] h-full" onClick={onClick}>
      <CardHeader>
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-sm">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
    </Card>
  );

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back, {profile?.name || 'User'}!
          </h1>
          <p className="text-muted-foreground mt-1">
            {isDirector 
              ? "Here's what's happening in the CDC today." 
              : "Here's your personalized dashboard overview."
            }
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {isDirector && (
            <Badge variant="outline" className="px-3 py-1 flex items-center">
              <Shield className="mr-2 h-4 w-4" />
              SuperAdmin
            </Badge>
          )}
          <Badge variant="secondary" className="px-3 py-1">
            {profile?.role === 'cdc_director' ? 'CDC Director' : 'Faculty Member'}
          </Badge>
        </div>
      </div>

      {/* Profile Completion Alert */}
      {!profile?.profile_completed && (
        <Card className="border-warning bg-warning-light">
          <CardHeader className="flex flex-row items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-warning" />
            <div>
              <CardTitle className="text-base">Complete Your Profile</CardTitle>
              <CardDescription>
                Please update your profile information to get the most out of the CDC portal.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 items-stretch">
        {isDirector ? (
          <>
            <StatCard 
              title="Total Faculty" 
              value={stats.totalFaculty} 
              icon={Users} 
              color="text-blue-500"
              description="Registered faculty members"
            />
            <StatCard 
              title="Total Events" 
              value={stats.totalEvents} 
              icon={Calendar} 
              color="text-purple-500"
              description="Events organized"
            />
            <StatCard 
              title="Active Tasks" 
              value={stats.pendingTasks} 
              icon={CheckSquare} 
              color="text-orange-500"
              description="Tasks pending completion"
            />
            <StatCard 
              title="Upcoming Events" 
              value={stats.upcomingEvents} 
              icon={Clock} 
              color="text-green-500"
              description="Events scheduled"
            />
          </>
        ) : (
          <>
            <StatCard 
              title="My Tasks" 
              value={stats.totalTasks} 
              icon={CheckSquare} 
              color="text-orange-500"
              description="Total assigned tasks"
            />
            <StatCard 
              title="Pending Tasks" 
              value={stats.pendingTasks} 
              icon={Clock} 
              color="text-red-500"
              description="Tasks to complete"
            />
            <StatCard 
              title="Completed Tasks" 
              value={stats.completedTasks} 
              icon={TrendingUp} 
              color="text-green-500"
              description="Tasks finished"
            />
            <StatCard 
              title="My Events" 
              value={stats.upcomingEvents} 
              icon={Calendar} 
              color="text-purple-500"
              description="Assigned events"
            />
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold mb-4">
          {isDirector ? 'SuperAdmin Actions' : 'Quick Actions'}
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-stretch">
          {isDirector ? (
            <>
              <QuickAction
                title="Create Event"
                description="Schedule a new CDC event"
                icon={Plus}
                onClick={() => window.location.href = '/events/create'}
                color="bg-purple-500"
              />
              <QuickAction
                title="Assign Task"
                description="Create and assign tasks to faculty"
                icon={Plus}
                onClick={() => window.location.href = '/tasks/create'}
                color="bg-orange-500"
              />
              <QuickAction
                title="Manage Faculty"
                description="View and manage faculty profiles"
                icon={Users}
                onClick={() => window.location.href = '/faculty'}
                color="bg-blue-500"
              />
              <QuickAction
                title="System Settings"
                description="Configure system settings and monitor performance"
                icon={Settings}
                onClick={() => window.location.href = '/settings'}
                color="bg-gray-500"
              />
              <QuickAction
                title="Faculty Directory"
                description="Browse all faculty profiles and information"
                icon={Activity}
                onClick={() => window.location.href = '/faculty/directory'}
                color="bg-green-500"
              />
            </>
          ) : (
            <>
              <QuickAction
                title="Update Profile"
                description="Complete your profile information"
                icon={Users}
                onClick={() => window.location.href = '/profile'}
                color="bg-blue-500"
              />
              <QuickAction
                title="View Tasks"
                description="Check your assigned tasks"
                icon={CheckSquare}
                onClick={() => window.location.href = '/tasks'}
                color="bg-orange-500"
              />
              <QuickAction
                title="My Events"
                description="View your assigned events"
                icon={Calendar}
                onClick={() => window.location.href = '/events'}
                color="bg-purple-500"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;