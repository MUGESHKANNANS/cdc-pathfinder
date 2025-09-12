import React, { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GraduationCap } from 'lucide-react';

const LoginPage = () => {
  const { user, loading, signInWithGoogle, signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const year = new Date().getFullYear();

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await signInWithEmail({ email, password });
    } finally {
      setSubmitting(false);
    }
  };

  // Redirect authenticated users
  if (user && !loading) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="relative h-screen overflow-hidden bg-white grid grid-cols-1 md:grid-cols-2">
      {/* Left panel */}
      <div
        className="relative hidden md:flex flex-col justify-between p-10 overflow-hidden text-white"
        style={{
          backgroundImage: "url('/placeholder.svg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-pink-600/50" />
        <div className="relative">
          <div className="flex items-center space-x-3">
            <div className="bg-white/20 rounded-lg p-2">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-white">CDC Portal</h2>
              <p className="text-xs text-white/80">KPRIET</p>
            </div>
          </div>
          <div className="mt-16 space-y-4">
            <h1 className="text-4xl font-bold">Shape Your Career</h1>
            <p className="text-white/90 max-w-sm">Visualize goals, track progress, and collaborate with CDC — all in one place.</p>
          </div>
        </div>
        <div className="relative space-y-2 text-white/70 text-sm">
          <p>© {year} KPRIET Career Development Cell</p>
          <p>Empowering careers through technology</p>
        </div>
      </div>

      {/* Right panel (form) */}
      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="text-left space-y-2">
            <h2 className="text-2xl font-semibold text-gray-900">Welcome back</h2>
            <p className="text-sm text-gray-500">Sign in to continue to your CDC dashboard.</p>
          </div>

          {/* Login Card */}
          <Card className="shadow-sm border border-gray-200 bg-white">
            <CardHeader className="space-y-1">
              <CardTitle className="text-lg font-medium text-gray-900">Your credentials</CardTitle>
              <CardDescription className="text-sm text-gray-500">
                Enter your email and password to continue
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Email / Password */}
              <form onSubmit={handleEmailSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>

                {/* Forgot Password Link */}
                <div className="text-center">
                  <Link 
                    to="/forgot-password" 
                    className="text-sm text-pink-600 hover:text-pink-700 underline"
                  >
                    Forgot your password?
                  </Link>
                </div>

                <Button type="submit" size="lg" className="w-full h-11 text-base font-medium bg-pink-600 text-white hover:bg-pink-700" disabled={submitting}>
                  {submitting ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Or continue with</span>
                </div>
              </div>

              <Button
                onClick={signInWithGoogle}
                size="lg"
                variant="outline"
                className="w-full h-11 justify-center gap-2 text-base font-medium border-pink-200 text-pink-700 hover:bg-pink-600 hover:text-white transition-all duration-200"
              >
                <img src="/google.svg" alt="Google" className="h-5 w-5" />
                <span>Continue with Google</span>
              </Button>

              
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;