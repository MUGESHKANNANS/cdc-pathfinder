import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Plus, Calendar, User, AlertCircle, CheckCircle2, Clock, Filter } from 'lucide-react';
import { Pagination } from '@/components/ui/pagination';

interface Task {
  id: string;
  title: string;
  description: string | null;
  notes: string | null;
  deadline: string | null;
  priority: string;
  status: string;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    name: string;
    email: string;
  } | null;
}


const Tasks = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'assigned' | 'created'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const fetchTasks = async () => {
    try {
      let query = supabase
        .from('tasks')
        .select('*');

      // If not CDC Director, only show tasks assigned to current user
      if (profile?.role !== 'cdc_director') {
        query = query.eq('assigned_to', profile?.user_id);
      }

      const { data: tasksData, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch assignee info separately
      const tasksWithAssignees = await Promise.all(
        (tasksData || []).map(async (task) => {
          if (task.assigned_to) {
            const { data: assigneeData } = await supabase
              .from('profiles')
              .select('name, email')
              .eq('user_id', task.assigned_to)
              .single();
            
            return { ...task, profiles: assigneeData };
          }
          return { ...task, profiles: null };
        })
      );

      setTasks(tasksWithAssignees);
    } catch (error: any) {
      console.error('Error fetching tasks:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tasks',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    if (profile) {
      fetchTasks();
    }
  }, [profile]);

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Task status updated'
      });

      await fetchTasks();
    } catch (error: any) {
      console.error('Error updating task:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task status',
        variant: 'destructive'
      });
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = searchTerm
        ? (task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (task.description || '').toLowerCase().includes(searchTerm.toLowerCase()))
        : true;
      // Status filter
      if (statusFilter !== 'all' && task.status !== statusFilter) {
        return false;
      }

      // Role-based filter
      if (filter === 'assigned') {
        return task.assigned_to === profile?.user_id;
      } else if (filter === 'created') {
        return task.created_by === profile?.user_id;
      }

      return matchesSearch;
    });
  }, [tasks, searchTerm, statusFilter, filter, profile?.user_id]);

  const paginatedTasks = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredTasks.slice(startIndex, endIndex);
  }, [filteredTasks, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, statusFilter, searchTerm]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-destructive';
      case 'medium': return 'bg-orange-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-muted';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'pending': return 'bg-yellow-500';
      default: return 'bg-muted';
    }
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-muted-foreground">Please log in to access tasks.</p>
        </div>
      </div>
    );
  }

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
          <h1 className="text-3xl font-bold text-foreground">Task Management</h1>
          <p className="text-muted-foreground">Manage and track tasks and assignments</p>
        </div>
        {profile.role === 'cdc_director' && (
          <Button onClick={() => navigate('/tasks/create')}>
            <Plus className="mr-2 h-4 w-4" />
            Create Task
          </Button>
        )}
      </div>

      {/* Filters (inline) */}
      <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap w-full">
        <Input
          placeholder="Search tasks..."
          value={searchTerm}
          onChange={(e)=>setSearchTerm(e.target.value)}
          className="flex-[3] min-w-[220px] h-12 rounded-xl border border-indigo-300"
        />
        <div className="flex-1 min-w-[160px]">
          <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
            <SelectTrigger className="h-12 rounded-xl w-full border border-indigo-300">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="assigned">Assigned to Me</SelectItem>
              {profile.role === 'cdc_director' && (
                <SelectItem value="created">Created by Me</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
            <SelectTrigger className="h-12 rounded-xl w-full border border-indigo-300">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tasks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tasks ({filteredTasks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTasks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No tasks found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{task.title}</p>
                        {task.description && (
                          <p className="text-sm text-muted-foreground">{task.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {task.profiles ? (
                        <div>
                          <p className="font-medium">{task.profiles.name}</p>
                          <p className="text-sm text-muted-foreground">{task.profiles.email}</p>
                        </div>
                      ) : (
                        'Unassigned'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={getPriorityColor(task.priority)}>
                        {task.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(task.status)}>
                        {task.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {task.deadline ? (
                        <div className="flex items-center space-x-1 text-sm">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(task.deadline).toLocaleDateString()}</span>
                        </div>
                      ) : (
                        'No deadline'
                      )}
                    </TableCell>
                    <TableCell>
                      {task.assigned_to === profile.user_id && task.status !== 'completed' && (
                        <Select
                          value={task.status}
                          onValueChange={(value) => updateTaskStatus(task.id, value)}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {filteredTasks.length >= 20 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredTasks.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(newItemsPerPage) => {
            setItemsPerPage(newItemsPerPage);
            setCurrentPage(1);
          }}
          className="mt-6"
        />
      )}
    </div>
  );
};

export default Tasks;