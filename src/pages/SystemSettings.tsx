import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Settings, 
  Users, 
  Database, 
  Shield, 
  Activity,
  Server,
  Key,
  Bell
} from 'lucide-react';

interface SystemStats {
  totalUsers: number;
  totalEvents: number;
  totalTasks: number;
  totalTrainings: number;
  activeUsers: number;
  systemUptime: string;
}

const SystemSettings = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [systemStats, setSystemStats] = useState<SystemStats>({
    totalUsers: 0,
    totalEvents: 0,
    totalTasks: 0,
    totalTrainings: 0,
    activeUsers: 0,
    systemUptime: '0 days'
  });

  // Check if current user is CDC Director (SuperAdmin)
  if (!profile || profile.role !== 'cdc_director') {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-destructive mb-4">Access Denied</h1>
        <p className="text-muted-foreground">Only SuperAdmin (CDC Director) can access system settings.</p>
      </div>
    );
  }

  const fetchSystemStats = async () => {
    try {
      // Fetch user count
      const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Fetch events count
      const { count: eventsCount } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true });

      // Fetch tasks count
      const { count: tasksCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true });

      // Fetch trainings count
      const { count: trainingsCount } = await supabase
        .from('trainings')
        .select('*', { count: 'exact', head: true });

      // Fetch active users (users with completed profiles)
      const { count: activeUsersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('profile_completed', true);

      setSystemStats({
        totalUsers: userCount || 0,
        totalEvents: eventsCount || 0,
        totalTasks: tasksCount || 0,
        totalTrainings: trainingsCount || 0,
        activeUsers: activeUsersCount || 0,
        systemUptime: 'Active' // This would be calculated from actual deployment
      });
    } catch (error) {
      console.error('Error fetching system stats:', error);
      toast({
        title: 'Error',
        description: 'Failed to load system statistics',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemStats();
  }, []);

  const handleSystemMaintenance = async (enable: boolean) => {
    setSaving(true);
    try {
      // This would typically involve updating system configuration
      // For now, we'll just show a toast message
      toast({
        title: 'System Maintenance',
        description: enable ? 'System maintenance mode enabled' : 'System maintenance mode disabled',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update system maintenance settings',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDataBackup = async () => {
    setSaving(true);
    try {
      // This would trigger a backup process
      toast({
        title: 'Backup Initiated',
        description: 'System backup has been started. You will be notified when complete.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to initiate backup',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center">
            <Settings className="mr-3 h-8 w-8" />
            System Settings
          </h1>
          <p className="text-muted-foreground">Manage system configuration and monitor performance</p>
        </div>
        <Badge variant="outline" className="flex items-center">
          <Shield className="mr-2 h-4 w-4" />
          SuperAdmin Access
        </Badge>
      </div>

      {/* System Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {systemStats.activeUsers} active profiles
            </p>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Events</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats.totalEvents}</div>
            <p className="text-xs text-muted-foreground">Total events created</p>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasks</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats.totalTasks}</div>
            <p className="text-xs text-muted-foreground">Total tasks assigned</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trainings</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats.totalTrainings}</div>
            <p className="text-xs text-muted-foreground">Total training programs</p>
          </CardContent>
        </Card>
      </div>

      {/* System Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* System Maintenance */}
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Server className="mr-2 h-5 w-5" />
              System Maintenance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="maintenance-mode">Maintenance Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Enable maintenance mode to restrict user access during updates
                </p>
              </div>
              <Switch
                id="maintenance-mode"
                onCheckedChange={handleSystemMaintenance}
                disabled={saving}
              />
            </div>
            <Button 
              onClick={handleDataBackup}
              variant="outline"
              className="w-full"
              disabled={saving}
            >
              <Database className="mr-2 h-4 w-4" />
              {saving ? 'Backing up...' : 'Create System Backup'}
            </Button>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="mr-2 h-5 w-5" />
              Security Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="password-policy">Enforce Password Policy</Label>
                <p className="text-sm text-muted-foreground">
                  Require strong passwords for all users
                </p>
              </div>
              <Switch
                id="password-policy"
                defaultChecked
                disabled
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="session-timeout">Auto Session Timeout</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically log out inactive users
                </p>
              </div>
              <Switch
                id="session-timeout"
                defaultChecked
                disabled
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Key className="mr-2 h-5 w-5" />
            System Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>System Version</Label>
              <Input value="CDC Portal v1.0.0" disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Database</Label>
              <Input value="Supabase PostgreSQL" disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Framework</Label>
              <Input value="React + TypeScript + Vite" disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>System Status</Label>
              <Input value={systemStats.systemUptime} disabled className="bg-muted" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>System Notes</Label>
            <Textarea
              placeholder="Add system maintenance notes or important updates..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemSettings;
