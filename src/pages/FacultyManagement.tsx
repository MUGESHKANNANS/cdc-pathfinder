import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Eye, Users, Edit, Trash2, MoreHorizontal } from 'lucide-react';

interface FacultyAccount {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  department: string | null;
  profile_completed: boolean;
  created_at: string;
}

interface CreateFacultyForm {
  email: string;
  password: string;
  name: string;
  department: string;
}

const FacultyManagement = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [facultyList, setFacultyList] = useState<FacultyAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CreateFacultyForm>({
    email: '',
    password: '',
    name: '',
    department: ''
  });

  // Check if current user is CDC Director
  if (!profile || profile.role !== 'cdc_director') {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-destructive mb-4">Access Denied</h1>
        <p className="text-muted-foreground">Only CDC Directors can access this page.</p>
      </div>
    );
  }

  const fetchFacultyAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'faculty')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFacultyList(data || []);
    } catch (error: any) {
      console.error('Error fetching faculty accounts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load faculty accounts',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFacultyAccounts();
  }, []);

  // Auto-open dialog if coming from Faculty Directory
  useEffect(() => {
    const state = location.state as { openCreateDialog?: boolean };
    if (state?.openCreateDialog) {
      setCreateDialogOpen(true);
      // Clear the state to prevent reopening on refresh
      navigate('/faculty', { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  const generatePassword = () => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  };

  const handleCreateFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-faculty-account', {
        body: {
          email: form.email,
          password: form.password,
          name: form.name,
          department: form.department
        }
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Faculty account created successfully',
      });

      // Reset form and close dialog
      setForm({ email: '', password: '', name: '', department: '' });
      setCreateDialogOpen(false);
      
      // Refresh faculty list
      await fetchFacultyAccounts();

    } catch (error: any) {
      console.error('Error creating faculty account:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create faculty account',
        variant: 'destructive'
      });
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setForm({ email: '', password: '', name: '', department: '' });
  };

  const handleEditFaculty = (facultyId: string) => {
    navigate(`/faculty/edit/${facultyId}`);
  };

  const handleViewProfile = (facultyId: string) => {
    navigate(`/faculty/directory`);
  };

  const handleDeleteFaculty = async (facultyId: string, facultyEmail: string) => {
    if (!confirm(`Are you sure you want to delete the faculty account for ${facultyEmail}? This action cannot be undone.`)) {
      return;
    }

    try {
      // First, delete the profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', facultyId);

      if (profileError) throw profileError;

      // Note: We cannot delete the auth user directly from the client
      // This would need to be handled by a server function or admin API
      toast({
        title: 'Success',
        description: 'Faculty profile deleted successfully. Note: The auth account deletion requires server-side processing.',
      });

      // Refresh the faculty list
      await fetchFacultyAccounts();
    } catch (error: any) {
      console.error('Error deleting faculty:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete faculty account',
        variant: 'destructive'
      });
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
          <h1 className="text-3xl font-bold text-foreground">Faculty Management</h1>
          <p className="text-muted-foreground">Create and manage faculty accounts</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <UserPlus className="mr-2 h-4 w-4" />
              Create Faculty Account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Faculty Account</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateFaculty} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="faculty@kpriet.ac.in"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Dr. John Doe"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  type="text"
                  value={form.department}
                  onChange={(e) => setForm(prev => ({ ...prev, department: e.target.value }))}
                  placeholder="Computer Science & Engineering"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Temporary Password *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setForm(prev => ({ ...prev, password: generatePassword() }))}
                  >
                    Generate
                  </Button>
                </div>
                <Input
                  id="password"
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter temporary password"
                  required
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetForm();
                    setCreateDialogOpen(false);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Account'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Faculty</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{facultyList.length}</div>
          </CardContent>
        </Card>
        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profiles Completed</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {facultyList.filter(f => f.profile_completed).length}
            </div>
          </CardContent>
        </Card>
        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Setup</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {facultyList.filter(f => !f.profile_completed).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Faculty List */}
      <Card>
        <CardHeader>
          <CardTitle>Faculty Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {facultyList.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No faculty accounts found.</p>
              <p className="text-sm text-muted-foreground mt-1">Create your first faculty account to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {facultyList.map((faculty) => (
                  <TableRow key={faculty.id}>
                    <TableCell className="font-medium">
                      {faculty.name || 'Not Set'}
                    </TableCell>
                    <TableCell>{faculty.email}</TableCell>
                    <TableCell>{faculty.department || 'Not Set'}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={faculty.profile_completed ? 'default' : 'secondary'}
                      >
                        {faculty.profile_completed ? 'Active' : 'Pending Setup'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(faculty.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditFaculty(faculty.id)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleViewProfile(faculty.id)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteFaculty(faculty.id, faculty.email)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Account
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FacultyManagement;