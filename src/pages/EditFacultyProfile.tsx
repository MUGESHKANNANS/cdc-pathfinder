import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, User } from 'lucide-react';

interface FacultyProfile {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  department: string | null;
  academic_title: string | null;
  position: string | null;
  date_of_birth: string | null;
  alternate_email: string | null;
  phone_number: string | null;
  alternate_phone_number: string | null;
  educational_background: string | null;
  professional_experience: string | null;
  specialization: string | null;
  profile_completed: boolean;
}

const EditFacultyProfile = () => {
  const { profile } = useAuth();
  const { facultyId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [facultyProfile, setFacultyProfile] = useState<FacultyProfile | null>(null);

  // Check access rights
  const isDirector = profile?.role === 'cdc_director';
  const isOwnProfile = profile?.id === facultyId;

  if (!profile || (!isDirector && !isOwnProfile)) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-destructive mb-4">Access Denied</h1>
        <p className="text-muted-foreground">You don't have permission to edit this profile.</p>
      </div>
    );
  }

  const fetchFacultyProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', facultyId)
        .single();

      if (error) throw error;
      setFacultyProfile(data);
    } catch (error: any) {
      console.error('Error fetching faculty profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to load faculty profile',
        variant: 'destructive'
      });
      navigate('/faculty/directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (facultyId) {
      fetchFacultyProfile();
    }
  }, [facultyId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facultyProfile) return;

    setSaving(true);
    try {
      const updateData: Partial<FacultyProfile> = {
        name: facultyProfile.name,
        academic_title: facultyProfile.academic_title,
        position: facultyProfile.position,
        date_of_birth: facultyProfile.date_of_birth,
        alternate_email: facultyProfile.alternate_email,
        phone_number: facultyProfile.phone_number,
        alternate_phone_number: facultyProfile.alternate_phone_number,
        educational_background: facultyProfile.educational_background,
        professional_experience: facultyProfile.professional_experience,
        specialization: facultyProfile.specialization,
        profile_completed: true,
      };

      // Directors can also update department
      if (isDirector) {
        updateData.department = facultyProfile.department;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', facultyId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });

      // Navigate back
      if (isDirector) {
        navigate('/faculty/directory');
      } else {
        navigate('/profile');
      }
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof FacultyProfile, value: string) => {
    setFacultyProfile(prev => prev ? { ...prev, [field]: value } : null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!facultyProfile) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-destructive mb-4">Profile Not Found</h1>
        <p className="text-muted-foreground">The requested faculty profile could not be found.</p>
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
            onClick={() => navigate(isDirector ? '/faculty/directory' : '/profile')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {isOwnProfile ? 'Edit My Profile' : 'Edit Faculty Profile'}
            </h1>
            <p className="text-muted-foreground">
              {isOwnProfile ? 'Update your personal and professional information' : `Editing profile for ${facultyProfile.name || facultyProfile.email}`}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Basic Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={facultyProfile.name || ''}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Enter full name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email (Read-only)</Label>
              <Input
                id="email"
                value={facultyProfile.email}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={facultyProfile.department || ''}
                onChange={(e) => updateField('department', e.target.value)}
                placeholder="Enter department"
                disabled={!isDirector}
                className={!isDirector ? 'bg-muted' : ''}
              />
              {!isDirector && (
                <p className="text-xs text-muted-foreground">Department can only be changed by CDC Director</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="academic_title">Academic Title</Label>
              <Input
                id="academic_title"
                value={facultyProfile.academic_title || ''}
                onChange={(e) => updateField('academic_title', e.target.value)}
                placeholder="e.g., Dr., Prof., Assistant Professor"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position">Position</Label>
              <Input
                id="position"
                value={facultyProfile.position || ''}
                onChange={(e) => updateField('position', e.target.value)}
                placeholder="e.g., Head of Department, Lecturer"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={facultyProfile.date_of_birth || ''}
                onChange={(e) => updateField('date_of_birth', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone_number">Phone Number</Label>
              <Input
                id="phone_number"
                value={facultyProfile.phone_number || ''}
                onChange={(e) => updateField('phone_number', e.target.value)}
                placeholder="Enter phone number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="alternate_phone_number">Alternate Phone</Label>
              <Input
                id="alternate_phone_number"
                value={facultyProfile.alternate_phone_number || ''}
                onChange={(e) => updateField('alternate_phone_number', e.target.value)}
                placeholder="Enter alternate phone"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="alternate_email">Alternate Email</Label>
              <Input
                id="alternate_email"
                type="email"
                value={facultyProfile.alternate_email || ''}
                onChange={(e) => updateField('alternate_email', e.target.value)}
                placeholder="Enter alternate email"
              />
            </div>
          </CardContent>
        </Card>

        {/* Professional Background */}
        <Card>
          <CardHeader>
            <CardTitle>Professional Background</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="educational_background">Educational Background</Label>
              <Textarea
                id="educational_background"
                value={facultyProfile.educational_background || ''}
                onChange={(e) => updateField('educational_background', e.target.value)}
                placeholder="Describe your educational qualifications, degrees, certifications..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="professional_experience">Professional Experience</Label>
              <Textarea
                id="professional_experience"
                value={facultyProfile.professional_experience || ''}
                onChange={(e) => updateField('professional_experience', e.target.value)}
                placeholder="Describe your work experience, previous positions, achievements..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="specialization">Areas of Specialization</Label>
              <Textarea
                id="specialization"
                value={facultyProfile.specialization || ''}
                onChange={(e) => updateField('specialization', e.target.value)}
                placeholder="Describe your areas of expertise, research interests, specializations..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(isDirector ? '/faculty/directory' : '/profile')}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default EditFacultyProfile;