import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateFacultyRequest {
  email: string;
  password: string;
  name?: string;
  department?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create admin Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get the current user from the request to verify they're a CDC Director
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Verify the requesting user is a CDC Director
    const token = authHeader.replace('Bearer ', '');
    const { data: user, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      console.error('User verification failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Check if user is CDC Director
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.user.id)
      .single();

    if (profileError || profile?.role !== 'cdc_director') {
      console.error('Role verification failed:', profileError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Only CDC Directors can create faculty accounts' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const { email, password, name, department }: CreateFacultyRequest = await req.json();

    // Validate input
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Create the faculty user account
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email for faculty accounts
      user_metadata: {
        name: name || null,
        created_by_director: true
      }
    });

    if (createError) {
      console.error('Error creating faculty account:', createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Update the profile with additional information
    if (newUser.user) {
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({
          name: name || null,
          department: department || null,
          role: 'faculty'
        })
        .eq('user_id', newUser.user.id);

      if (profileUpdateError) {
        console.error('Error updating profile:', profileUpdateError);
        // Don't fail the entire operation, just log the error
      }
    }

    console.log('Faculty account created successfully:', email);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Faculty account created successfully',
        user: {
          id: newUser.user?.id,
          email: newUser.user?.email,
          name: name
        }
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error: any) {
    console.error('Error in create-faculty-account function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
};

serve(handler);