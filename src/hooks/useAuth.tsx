import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  role: 'cdc_director' | 'faculty';
  name: string | null;
  department: string | null;
  academic_title: string | null;
  position: string | null;
  date_of_birth: string | null;
  alternate_email: string | null;
  phone_number: string | null;
  alternate_phone_number: string | null;
  profile_picture_url: string | null;
  educational_background: string | null;
  professional_experience: string | null;
  specialization: string | null;
  profile_completed: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  needsPasswordChange: boolean;
  signInWithEmail: (params: { email: string; password: string }) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const { toast } = useToast();

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  };

  const ensureProfileExists = async (currentUser: User) => {
    // Try to fetch
    const existing = await fetchProfile(currentUser.id);
    if (existing) {
      // Require password change only if created by director AND password not yet changed
      const isCreatedByDirector = currentUser.user_metadata?.created_by_director === true;
      const passwordChanged = currentUser.user_metadata?.password_changed === true;
      const isFirstLogin = isCreatedByDirector && !passwordChanged;
      setNeedsPasswordChange(isFirstLogin);
      return existing;
    }

    // Create minimal default profile
    const defaultProfile = {
      user_id: currentUser.id,
      email: currentUser.email ?? '',
      role: 'faculty' as const,
      name: currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || null,
      department: null,
      academic_title: null,
      position: null,
      date_of_birth: null,
      alternate_email: null,
      phone_number: null,
      alternate_phone_number: null,
      profile_picture_url: null,
      educational_background: null,
      professional_experience: null,
      specialization: null,
      profile_completed: false,
    };

    const { data, error } = await supabase
      .from('profiles')
      .insert(defaultProfile)
      .select('*')
      .single();

    if (error) {
      console.error('Error creating default profile:', error);
      return null;
    }
    return data as Profile;
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await ensureProfileExists(user);
      setProfile(profileData);
      // Reset password change requirement after profile refresh
      if (profileData?.profile_completed) {
        setNeedsPasswordChange(false);
      }
    }
  };

  useEffect(() => {
    const clearOAuthHashFromUrl = () => {
      if (typeof window !== 'undefined' && window.location.hash &&
          (window.location.hash.includes('access_token=') || window.location.hash.includes('refresh_token=') || window.location.hash.includes('provider_token=') )) {
        const cleanUrl = window.location.pathname + window.location.search;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Clean up the OAuth hash fragment once we have a session
          clearOAuthHashFromUrl();
          // Defer profile fetch to avoid deadlock
          setTimeout(async () => {
            const profileData = await ensureProfileExists(session.user!);
            setProfile(profileData);
            setLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // In case the SDK already parsed tokens on first load, clear the hash
        clearOAuthHashFromUrl();
        setTimeout(async () => {
          const profileData = await ensureProfileExists(session.user!);
          setProfile(profileData);
          setLoading(false);
        }, 0);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      const redirectUrl = `${window.location.origin}/dashboard`;
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl
        }
      });

      if (error) {
        toast({
          title: "Authentication Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Authentication Error",
        description: "An unexpected error occurred during sign in.",
        variant: "destructive",
      });
    }
  };

  const signInWithEmail = async ({ email, password }: { email: string; password: string }) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({
          title: "Authentication Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Authentication Error",
        description: "An unexpected error occurred during sign in.",
        variant: "destructive",
      });
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast({
          title: "Sign Out Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Sign Out Error",
        description: "An unexpected error occurred during sign out.",
        variant: "destructive",
      });
    }
  };

  const value = {
    user,
    session,
    profile,
    loading,
    needsPasswordChange,
    signInWithEmail,
    signInWithGoogle,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};