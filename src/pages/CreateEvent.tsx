import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar as CalendarIcon, Upload, X, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface Faculty {
  id: string;
  user_id: string;
  name: string | null;
  email: string;
}

const eventCategories = [
  'Seminar',
  'Workshop',
  'Career Fair',
  'Guest Lecture',
  'Placement Drive',
  'Training Session',
  'Conference',
  'Other'
];

const CreateEvent = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    organized_by: '',
    event_date: '',
    event_time: '',
    venue: '',
    category: '',
    assigned_faculty: [] as string[]
  });

  // Redirect if not director
  useEffect(() => {
    if (profile && profile.role !== 'cdc_director') {
      navigate('/events');
      toast({
        title: "Access Denied",
        description: "Only CDC Directors can create events.",
        variant: "destructive"
      });
    }
  }, [profile, navigate]);

  useEffect(() => {
    fetchFaculty();
  }, []);

  const fetchFaculty = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, name, email')
        .eq('role', 'faculty');

      if (error) throw error;
      setFaculty(data || []);
    } catch (error) {
      console.error('Error fetching faculty:', error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFacultyToggle = (facultyId: string) => {
    setFormData(prev => ({
      ...prev,
      assigned_faculty: prev.assigned_faculty.includes(facultyId)
        ? prev.assigned_faculty.filter(id => id !== facultyId)
        : [...prev.assigned_faculty, facultyId]
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid File Type",
          description: "Please upload PDF, JPG, or PNG files only.",
          variant: "destructive"
        });
        return;
      }
      
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please upload files smaller than 10MB.",
          variant: "destructive"
        });
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const uploadFile = async (eventId: string): Promise<string | null> => {
    if (!selectedFile) return null;

    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${eventId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('event-attachments')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      return filePath;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.event_date) {
      toast({
        title: "Missing Required Fields",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Create event
      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({
          title: formData.title,
          description: formData.description || null,
          organized_by: formData.organized_by || null,
          event_date: formData.event_date,
          event_time: formData.event_time || null,
          venue: formData.venue || null,
          category: formData.category || null,
          created_by: profile?.user_id
        })
        .select()
        .single();

      if (eventError) throw eventError;

      // Upload file if exists
      let attachmentUrl = null;
      if (selectedFile) {
        attachmentUrl = await uploadFile(event.id);
        
        // Update event with attachment URL
        const { error: updateError } = await supabase
          .from('events')
          .update({ attachment_url: attachmentUrl })
          .eq('id', event.id);

        if (updateError) throw updateError;
      }

      // Create faculty assignments
      if (formData.assigned_faculty.length > 0) {
        const assignments = formData.assigned_faculty.map(facultyId => ({
          event_id: event.id,
          faculty_id: facultyId
        }));

        const { error: assignmentError } = await supabase
          .from('event_assignments')
          .insert(assignments);

        if (assignmentError) throw assignmentError;
      }

      toast({
        title: "Success",
        description: "Event created successfully!",
      });

      navigate('/events');
    } catch (error) {
      console.error('Error creating event:', error);
      toast({
        title: "Error",
        description: "Failed to create event. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (profile?.role !== 'cdc_director') {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Create Event</h1>
        <p className="text-muted-foreground">Create a new event and assign faculty members</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
            <CardDescription>Basic information about the event</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Event Name *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Enter event name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Event Category</Label>
                <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventCategories.map(category => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Event Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Describe the event..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="organized_by">Organized By</Label>
                <Input
                  id="organized_by"
                  value={formData.organized_by}
                  onChange={(e) => handleInputChange('organized_by', e.target.value)}
                  placeholder="CDC / Faculty Name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="venue">Venue / Location</Label>
                <Input
                  id="venue"
                  value={formData.venue}
                  onChange={(e) => handleInputChange('venue', e.target.value)}
                  placeholder="Event location"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Date & Time</CardTitle>
            <CardDescription>When will the event take place?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="event_date">Event Date *</Label>
                <Input
                  id="event_date"
                  type="date"
                  value={formData.event_date}
                  onChange={(e) => handleInputChange('event_date', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event_time">Event Time</Label>
                <Input
                  id="event_time"
                  type="time"
                  value={formData.event_time}
                  onChange={(e) => handleInputChange('event_time', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attachments</CardTitle>
            <CardDescription>Upload agenda PDF or event poster</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        PDF, JPG, PNG (max 10MB)
                      </p>
                    </div>
                  </Label>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>
              
              {selectedFile && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{selectedFile.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Assign Faculty
            </CardTitle>
            <CardDescription>Select faculty members to assign to this event</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {faculty.map(member => (
                <div key={member.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={member.id}
                    checked={formData.assigned_faculty.includes(member.user_id)}
                    onCheckedChange={() => handleFacultyToggle(member.user_id)}
                  />
                  <Label htmlFor={member.id} className="cursor-pointer flex-1">
                    <div>
                      <p className="text-sm font-medium">{member.name || 'Unnamed'}</p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </div>
                  </Label>
                </div>
              ))}
            </div>
            
            {formData.assigned_faculty.length > 0 && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">
                  Selected Faculty ({formData.assigned_faculty.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {formData.assigned_faculty.map(facultyId => {
                    const member = faculty.find(f => f.user_id === facultyId);
                    return (
                      <span key={facultyId} className="inline-flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground text-xs rounded">
                        {member?.name || member?.email}
                        <X 
                          className="h-3 w-3 cursor-pointer" 
                          onClick={() => handleFacultyToggle(facultyId)}
                        />
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/events')}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Event'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CreateEvent;