import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Users, Calendar, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface Faculty {
  id: string;
  user_id: string;
  name: string;
  email: string;
  department: string;
}

const CreateTraining = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [selectedFaculty, setSelectedFaculty] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    training_name: '',
    batch: '',
    description: '',
    organized_by: '',
    start_date: '',
    end_date: '',
    mode: 'Online'
  });

  useEffect(() => {
    if (profile?.role !== 'cdc_director') {
      navigate('/training');
      return;
    }
    fetchFaculty();
  }, [profile, navigate]);

  const fetchFaculty = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, name, email, department')
        .eq('role', 'faculty')
        .order('name');

      if (error) throw error;
      setFaculty(data || []);
    } catch (error) {
      console.error('Error fetching faculty:', error);
      toast({
        title: "Error",
        description: "Failed to fetch faculty list",
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFacultyToggle = (facultyId: string) => {
    setSelectedFaculty(prev => 
      prev.includes(facultyId) 
        ? prev.filter(id => id !== facultyId)
        : [...prev, facultyId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.training_name || !formData.batch || !formData.start_date || !formData.end_date) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (selectedFaculty.length === 0) {
      toast({
        title: "Error",
        description: "Please assign at least one faculty member",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Create training
      const { data: training, error: trainingError } = await supabase
        .from('trainings')
        .insert({
          ...formData,
          created_by: profile?.user_id
        })
        .select()
        .single();

      if (trainingError) throw trainingError;

      // Create training assignments
      const assignments = selectedFaculty.map(facultyId => ({
        training_id: training.id,
        faculty_id: facultyId
      }));

      const { error: assignmentError } = await supabase
        .from('training_assignments')
        .insert(assignments);

      if (assignmentError) throw assignmentError;

      toast({
        title: "Success",
        description: "Training program created successfully",
      });

      navigate('/training');
    } catch (error) {
      console.error('Error creating training:', error);
      toast({
        title: "Error",
        description: "Failed to create training program",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (profile?.role !== 'cdc_director') {
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/training')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Training Program</h1>
          <p className="text-muted-foreground">Set up a new training program for faculty</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Training Details</CardTitle>
          <CardDescription>Fill in the training program information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="training_name">Training Name *</Label>
                <Input
                  id="training_name"
                  placeholder="e.g., Aptitude Training, Python Bootcamp"
                  value={formData.training_name}
                  onChange={(e) => handleInputChange('training_name', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="batch">Batch *</Label>
                <Input
                  id="batch"
                  placeholder="e.g., 2024, Batch A"
                  value={formData.batch}
                  onChange={(e) => handleInputChange('batch', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of the training program"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="organized_by">Organized By</Label>
                <Input
                  id="organized_by"
                  placeholder="e.g., CDC, Training Department"
                  value={formData.organized_by}
                  onChange={(e) => handleInputChange('organized_by', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mode">Mode *</Label>
                <Select value={formData.mode} onValueChange={(value) => handleInputChange('mode', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Online">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Online
                      </div>
                    </SelectItem>
                    <SelectItem value="Offline">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Offline
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date *</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => handleInputChange('start_date', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date *</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => handleInputChange('end_date', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <Label>Assign Faculty *</Label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto border rounded-lg p-4">
                {faculty.map((member) => (
                  <div key={member.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={member.id}
                      checked={selectedFaculty.includes(member.user_id)}
                      onCheckedChange={() => handleFacultyToggle(member.user_id)}
                    />
                    <Label htmlFor={member.id} className="text-sm font-normal cursor-pointer">
                      <div>
                        <div className="font-medium">{member.name}</div>
                        <div className="text-xs text-muted-foreground">{member.department}</div>
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
              {selectedFaculty.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {selectedFaculty.length} faculty member(s) selected
                </p>
              )}
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Calendar className="h-4 w-4 mr-2" />
                    Create Training Program
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/training')}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateTraining;