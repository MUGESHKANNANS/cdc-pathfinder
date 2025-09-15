import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Calendar, User, AlertCircle } from 'lucide-react';

interface Faculty {
  user_id: string;
  name: string;
  email: string;
}

const CreateTask = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [faculty, setFaculty] = useState<Faculty[]>([]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigned_to: '',
    deadline: '',
    priority: 'medium'
  });

  // Redirect if not director
  useEffect(() => {
    if (profile && profile.role !== 'cdc_director') {
      navigate('/tasks');
      toast({
        title: "Access Denied",
        description: "Only CDC Directors can create tasks.",
        variant: "destructive"
      });
    }
  }, [profile, navigate, toast]);

  useEffect(() => {
    fetchFaculty();
  }, []);

  const fetchFaculty = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .eq('role', 'faculty')
        .order('name');

      if (error) throw error;
      setFaculty(data || []);
    } catch (error: any) {
      console.error('Error fetching faculty:', error);
      toast({
        title: "Error",
        description: "Failed to fetch faculty list",
        variant: "destructive"
      });
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('tasks')
        .insert({
          title: formData.title,
          description: formData.description || null,
          assigned_to: formData.assigned_to || null,
          deadline: formData.deadline || null,
          priority: formData.priority,
          created_by: profile?.user_id,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Task created successfully'
      });

      // Reset form
      setFormData({
        title: '',
        description: '',
        assigned_to: '',
        deadline: '',
        priority: 'medium'
      });

      // Navigate back to tasks
      navigate('/tasks');
    } catch (error: any) {
      console.error('Error creating task:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create task',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-muted-foreground">Please log in to create tasks.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            onClick={() => navigate('/tasks')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tasks
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Create New Task</h1>
            <p className="text-muted-foreground">Create and assign a new task to faculty members</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5" />
              <span>Task Details</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Task Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Enter task title"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Enter task description (optional)"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Assignment Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Assignment Details</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assigned_to">Assign To</Label>
              <Select value={formData.assigned_to} onValueChange={(value) => handleInputChange('assigned_to', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select faculty member" />
                </SelectTrigger>
                <SelectContent>
                  {faculty.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id} className="group">
                      <div className="flex flex-col">
                        <span className="font-medium">{member.name || 'No Name'}</span>
                        <span className="text-xs text-muted-foreground group-hover:text-white">{member.email}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Leave empty to create unassigned task</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deadline">Deadline</Label>
                <Input
                  id="deadline"
                  type="datetime-local"
                  value={formData.deadline}
                  onChange={(e) => handleInputChange('deadline', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={formData.priority} onValueChange={(value) => handleInputChange('priority', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/tasks')}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading || !formData.title.trim()}>
            <Save className="mr-2 h-4 w-4" />
            {loading ? 'Creating...' : 'Create Task'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CreateTask;
