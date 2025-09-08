import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Chrome, GraduationCap, Users, Building2 } from 'lucide-react';

const LoginPage = () => {
  const { user, loading, signInWithGoogle } = useAuth();

  // Redirect authenticated users
  if (user && !loading) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="bg-gradient-primary rounded-full p-4 shadow-lg">
              <GraduationCap className="h-12 w-12 text-primary-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              CDC Portal
            </h1>
            <h2 className="text-xl font-semibold text-foreground">
              KPRIET Career Development Cell
            </h2>
            <p className="text-muted-foreground">
              Faculty & Student Career Visualization Platform
            </p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="shadow-xl border-0 bg-gradient-card">
          <CardHeader className="text-center space-y-4">
            <CardTitle className="text-2xl font-semibold">Welcome Back</CardTitle>
            <CardDescription className="text-base">
              Sign in to access your CDC dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Button
              onClick={signInWithGoogle}
              size="lg"
              className="w-full h-12 text-base font-medium bg-gradient-primary hover:bg-primary-hover transition-all duration-200"
            >
              <Chrome className="mr-3 h-5 w-5" />
              Sign in with Google
            </Button>

            {/* Features */}
            <div className="pt-6 border-t border-border/50">
              <p className="text-sm text-muted-foreground text-center mb-4">
                Platform Features
              </p>
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center space-x-3 text-sm">
                  <Users className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground">Role-based Access Control</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground">Event & Task Management</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <GraduationCap className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground">Career Development Tracking</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>© 2024 KPRIET Career Development Cell</p>
          <p className="mt-1">Empowering careers through technology</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;