import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Eye, Edit, UserX, UserCheck, Search, Filter, Users, UserPlus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DialogFooter } from '@/components/ui/dialog';

interface FacultyProfile {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  department: string | null;
  academic_title: string | null;
  position: string | null;
  phone_number: string | null;
  profile_completed: boolean;
  created_at: string;
  date_of_birth: string | null;
  alternate_email: string | null;
  alternate_phone_number: string | null;
  educational_background: string | null;
  professional_experience: string | null;
  specialization: string | null;
}

const FacultyDirectory = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [facultyList, setFacultyList] = useState<FacultyProfile[]>([]);
  const [filteredFaculty, setFilteredFaculty] = useState<FacultyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedFaculty, setSelectedFaculty] = useState<FacultyProfile | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
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

  const fetchFacultyProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'faculty')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFacultyList(data || []);
      setFilteredFaculty(data || []);
    } catch (error: any) {
      console.error('Error fetching faculty profiles:', error);
      toast({
        title: 'Error',
        description: 'Failed to load faculty profiles',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFacultyProfiles();
  }, []);

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
      const { error } = await supabase.functions.invoke('create-faculty-account', {
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
      setForm({ email: '', password: '', name: '', department: '' });
      setCreateDialogOpen(false);
      await fetchFacultyProfiles();
    } catch (error: any) {
      console.error('Error creating faculty account:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to create faculty account',
        variant: 'destructive'
      });
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setForm({ email: '', password: '', name: '', department: '' });
  };

  const handleDeleteFaculty = async (facultyId: string, facultyEmail: string) => {
    if (!confirm(`Are you sure you want to delete the faculty profile for ${facultyEmail}? This action cannot be undone.`)) {
      return;
    }
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', facultyId);
      if (error) throw error;
      toast({
        title: 'Success',
        description: 'Faculty profile deleted successfully. Note: Auth user deletion is server-side only.',
      });
      await fetchFacultyProfiles();
    } catch (error: any) {
      console.error('Error deleting faculty:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete faculty profile',
        variant: 'destructive'
      });
    }
  };

  // Filter faculty based on search and filters
  useEffect(() => {
    let filtered = facultyList;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(faculty => 
        faculty.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        faculty.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Department filter
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(faculty => faculty.department === departmentFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'active') {
        filtered = filtered.filter(faculty => faculty.profile_completed);
      } else if (statusFilter === 'inactive') {
        filtered = filtered.filter(faculty => !faculty.profile_completed);
      }
    }

    setFilteredFaculty(filtered);
  }, [searchTerm, departmentFilter, statusFilter, facultyList]);

  // Get unique departments for filter
  const departments = [...new Set(facultyList.map(f => f.department).filter(Boolean))];

  const handleViewProfile = (faculty: FacultyProfile) => {
    setSelectedFaculty(faculty);
  };

  const handleEditProfile = (facultyId: string) => {
    navigate(`/faculty/edit/${facultyId}`);
  };

  const toggleFacultyStatus = async (faculty: FacultyProfile) => {
    try {
      const newStatus = !faculty.profile_completed;
      const { error } = await supabase
        .from('profiles')
        .update({ profile_completed: newStatus })
        .eq('id', faculty.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Faculty ${newStatus ? 'activated' : 'deactivated'} successfully`,
      });

      // Refresh faculty list
      await fetchFacultyProfiles();
    } catch (error: any) {
      console.error('Error updating faculty status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update faculty status',
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
          <h1 className="text-3xl font-bold text-foreground">Faculty Directory</h1>
          <p className="text-muted-foreground">Search, filter, and manage all faculty profiles</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} variant="outline">
          <UserPlus className="mr-2 h-4 w-4" />
          Create Faculty
        </Button>
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
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

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Search className="h-5 w-5" />
            <span>Search & Filter Faculty</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <Label className="text-left">Search by Name or Email</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search faculty..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 h-10 border border-indigo-300"
                />
              </div>
            </div>

            {/* Department Filter */}
            <div className="space-y-2">
              <Label className="text-left">Filter by Department</Label>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="h-10 border border-indigo-300">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept!}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label className="text-left">Filter by Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10 border border-indigo-300">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-stretch">
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
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {facultyList.filter(f => f.profile_completed).length}
            </div>
          </CardContent>
        </Card>
        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <UserX className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {facultyList.filter(f => !f.profile_completed).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Filtered Results</CardTitle>
            <Filter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredFaculty.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Faculty Table */}
      <Card>
        <CardHeader>
          <CardTitle>Faculty List</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredFaculty.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No faculty found matching your filters.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFaculty.map((faculty) => (
                  <TableRow key={faculty.id}>
                    <TableCell className="font-medium">
                      {faculty.name || 'Not Set'}
                    </TableCell>
                    <TableCell>{faculty.email}</TableCell>
                    <TableCell>{faculty.department || 'Not Set'}</TableCell>
                    <TableCell>{faculty.phone_number || 'Not Set'}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={faculty.profile_completed ? 'default' : 'secondary'}
                      >
                        {faculty.profile_completed ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewProfile(faculty)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditProfile(faculty.id)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={faculty.profile_completed ? "destructive" : "default"}
                          onClick={() => toggleFacultyStatus(faculty)}
                        >
                          {faculty.profile_completed ? (
                            <UserX className="h-4 w-4" />
                          ) : (
                            <UserCheck className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteFaculty(faculty.id, faculty.email || 'Not Set')}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Profile Dialog */}
      <Dialog open={!!selectedFaculty} onOpenChange={() => setSelectedFaculty(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Faculty Profile Details</DialogTitle>
          </DialogHeader>
          {selectedFaculty && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Name</Label>
                  <p className="mt-1">{selectedFaculty.name || 'Not specified'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                  <p className="mt-1">{selectedFaculty.email}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Department</Label>
                  <p className="mt-1">{selectedFaculty.department || 'Not specified'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Academic Title</Label>
                  <p className="mt-1">{selectedFaculty.academic_title || 'Not specified'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Position</Label>
                  <p className="mt-1">{selectedFaculty.position || 'Not specified'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Phone</Label>
                  <p className="mt-1">{selectedFaculty.phone_number || 'Not specified'}</p>
                </div>
              </div>

              {/* Professional Details */}
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Educational Background</Label>
                  <p className="mt-1">{selectedFaculty.educational_background || 'Not specified'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Professional Experience</Label>
                  <p className="mt-1">{selectedFaculty.professional_experience || 'Not specified'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Specialization</Label>
                  <p className="mt-1">{selectedFaculty.specialization || 'Not specified'}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FacultyDirectory;