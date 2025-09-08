import React, { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { Edit, Mail, Phone, Calendar, MapPin, GraduationCap } from 'lucide-react';

const Profile = () => {
  const { profile, refreshProfile } = useAuth();

  useEffect(() => {
    if (!profile) {
      refreshProfile();
    }
  }, [profile, refreshProfile]);

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground gap-4">
        <div>Loading profile...</div>
        <Button variant="outline" onClick={refreshProfile}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Profile</h1>
          <p className="text-muted-foreground mt-1">
            Manage your professional information and settings
          </p>
        </div>
        <Button className="bg-gradient-primary">
          <Edit className="mr-2 h-4 w-4" />
          Edit Profile
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Card */}
        <div className="md:col-span-1">
          <Card>
            <CardHeader className="text-center">
              <div className="w-24 h-24 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                {profile.name ? profile.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'}
              </div>
              <CardTitle className="text-xl">{profile.name || 'Update Name'}</CardTitle>
              <CardDescription>
                <Badge className={profile.role === 'cdc_director' ? 'bg-primary' : 'bg-accent'}>
                  {profile.role === 'cdc_director' ? 'CDC Director' : 'Faculty Member'}
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center space-x-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{profile.email}</span>
              </div>
              {profile.department && (
                <div className="flex items-center space-x-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{profile.department}</span>
                </div>
              )}
              {profile.phone_number && (
                <div className="flex items-center space-x-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{profile.phone_number}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Details */}
        <div className="md:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <GraduationCap className="h-5 w-5" />
                <span>Basic Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Academic Title</label>
                <p className="mt-1 text-foreground">{profile.academic_title || 'Not specified'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Position</label>
                <p className="mt-1 text-foreground">{profile.position || 'Not specified'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Department</label>
                <p className="mt-1 text-foreground">{profile.department || 'Not specified'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Alternate Email</label>
                <p className="mt-1 text-foreground">{profile.alternate_email || 'Not provided'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Professional Background */}
          <Card>
            <CardHeader>
              <CardTitle>Professional Background</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Educational Background</label>
                <p className="mt-1 text-foreground">{profile.educational_background || 'Please update your educational background'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Professional Experience</label>
                <p className="mt-1 text-foreground">{profile.professional_experience || 'Please add your professional experience'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Areas of Specialization</label>
                <p className="mt-1 text-foreground">{profile.specialization || 'Please specify your areas of expertise'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Profile Completion */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Completion</CardTitle>
              <CardDescription>
                Complete your profile to unlock all features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Profile Status
                </span>
                <Badge variant={profile.profile_completed ? "default" : "secondary"}>
                  {profile.profile_completed ? "Complete" : "Incomplete"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;