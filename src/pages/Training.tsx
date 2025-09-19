import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Users, BookOpen, Plus, Search, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Pagination } from '@/components/ui/pagination';

interface Training {
  id: string;
  training_name: string;
  batch: string;
  description: string;
  organized_by: string;
  start_date: string;
  end_date: string;
  mode: string;
  status: string;
  progress_notes: string;
  created_at: string;
  faculty_names?: string[];
}

const Training = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [batchFilter, setBatchFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const isCDCDirector = profile?.role === 'cdc_director';

  useEffect(() => {
    fetchTrainings();
  }, [profile]);

  const fetchTrainings = async () => {
    try {
      let trainingsQuery;

      if (isCDCDirector) {
        // CDC Director sees all trainings
        trainingsQuery = supabase
          .from('trainings')
          .select('*')
          .order('created_at', { ascending: false });
      } else {
        // Faculty sees only assigned trainings
        trainingsQuery = supabase
          .from('training_assignments')
          .select(`
            trainings (*)
          `)
          .eq('faculty_id', profile?.user_id);
      }

      const { data, error } = await trainingsQuery;

      if (error) throw error;

      let processedTrainings: Training[];

      if (isCDCDirector) {
        processedTrainings = data || [];
        
        // Fetch faculty names for each training
        for (const training of processedTrainings) {
          const { data: assignments } = await supabase
            .from('training_assignments')
            .select(`
              faculty_id,
              profiles!training_assignments_faculty_id_fkey (name)
            `)
            .eq('training_id', training.id);

          training.faculty_names = assignments?.map(a => (a.profiles as any)?.name).filter(Boolean) || [];
        }
      } else {
        processedTrainings = data?.map(item => item.trainings).filter(Boolean) || [];
      }

      setTrainings(processedTrainings);
    } catch (error) {
      console.error('Error fetching trainings:', error);
      toast({
        title: "Error",
        description: "Failed to fetch trainings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateTrainingStatus = async (trainingId: string, status: string, notes?: string) => {
    try {
      const updates: any = { status };
      if (notes !== undefined) {
        updates.progress_notes = notes;
      }

      const { error } = await supabase
        .from('trainings')
        .update(updates)
        .eq('id', trainingId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Training status updated successfully",
      });

      fetchTrainings();
    } catch (error) {
      console.error('Error updating training:', error);
      toast({
        title: "Error",
        description: "Failed to update training status",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      'Upcoming': 'outline',
      'Ongoing': 'default',
      'Completed': 'secondary'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {status === 'Ongoing' && '🟢'} 
        {status === 'Upcoming' && '🔵'} 
        {status === 'Completed' && '⚪'} 
        {status}
      </Badge>
    );
  };

  const filteredTrainings = useMemo(() => {
    return trainings.filter(training => {
      const matchesSearch = training.training_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || training.status === statusFilter;
      const matchesBatch = batchFilter === 'All' || training.batch === batchFilter;
      return matchesSearch && matchesStatus && matchesBatch;
    });
  }, [trainings, searchTerm, statusFilter, batchFilter]);

  const paginatedTrainings = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredTrainings.slice(startIndex, endIndex);
  }, [filteredTrainings, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredTrainings.length / itemsPerPage);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, batchFilter]);

  const uniqueBatches = [...new Set(trainings.map(t => t.batch))];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Training Programs</h1>
          <p className="text-muted-foreground">
            {isCDCDirector ? 'Manage training programs and assignments' : 'View your assigned training programs'}
          </p>
        </div>
        {isCDCDirector && (
          <Button onClick={() => navigate('/training/create')} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Training
          </Button>
        )}
      </div>

      {/* Filters (inline) */}
      <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search training programs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-12 rounded-xl border border-indigo-300"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[220px] h-12 rounded-xl border border-indigo-300">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Status</SelectItem>
            <SelectItem value="Upcoming">Upcoming</SelectItem>
            <SelectItem value="Ongoing">Ongoing</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={batchFilter} onValueChange={setBatchFilter}>
          <SelectTrigger className="w-[220px] h-12 rounded-xl border border-indigo-300">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Batches</SelectItem>
            {uniqueBatches.map(batch => (
              <SelectItem key={batch} value={batch}>{batch}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Training Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {paginatedTrainings.map((training) => (
          <Card key={training.id} className="relative overflow-hidden transition-all hover:shadow-xl hover:-translate-y-0.5">
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-50 via-transparent to-pink-50" />
            <CardHeader className="relative">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {training.training_name}
                    <span className="inline-flex items-center rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5 text-[11px]">{training.batch}</span>
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">Organized by {training.organized_by}</CardDescription>
                </div>
                {getStatusBadge(training.status)}
              </div>
            </CardHeader>
            <CardContent className="relative space-y-4">
              <p className="text-sm text-muted-foreground line-clamp-3">
                {training.description}
              </p>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {format(new Date(training.start_date), 'MMM dd')} - {format(new Date(training.end_date), 'MMM dd, yyyy')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{training.mode}</span>
                </div>
                {training.faculty_names && training.faculty_names.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs">
                      {training.faculty_names.join(', ')}
                    </span>
                  </div>
                )}
              </div>

              {training.progress_notes && (
                <div className="p-3 bg-muted/60 rounded-md">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Progress Notes:</p>
                  <p className="text-sm">{training.progress_notes}</p>
                </div>
              )}

              {/* Faculty can update status */}
              {!isCDCDirector && training.status !== 'Completed' && (
                <div className="flex gap-2">
                  {training.status === 'Upcoming' && (
                    <Button 
                      size="sm" 
                      onClick={() => updateTrainingStatus(training.id, 'Ongoing')}
                      className="flex-1"
                    >
                      Start Training
                    </Button>
                  )}
                  {training.status === 'Ongoing' && (
                    <Button 
                      size="sm" 
                      onClick={() => updateTrainingStatus(training.id, 'Completed')}
                      className="flex-1"
                    >
                      Mark Complete
                    </Button>
                  )}
                </div>
              )}

              {/* Director actions */}
              {isCDCDirector && (
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => navigate(`/training/edit/${training.id}`)}
                    className="flex-1"
                  >
                    Edit
                  </Button>
                </div>
              )}
              <div className="pt-2 border-t text-xs text-muted-foreground">Created: {format(new Date(training.created_at), 'PP')}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {filteredTrainings.length >= 20 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredTrainings.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(newItemsPerPage) => {
            setItemsPerPage(newItemsPerPage);
            setCurrentPage(1);
          }}
          className="mt-6"
        />
      )}

      {filteredTrainings.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">No training programs found</h3>
          <p className="text-sm text-muted-foreground">
            {searchTerm ? 'Try adjusting your search or filters' : 
             isCDCDirector ? 'Create your first training program' : 'No training programs assigned to you'}
          </p>
        </div>
      )}
    </div>
  );
};

export default Training;