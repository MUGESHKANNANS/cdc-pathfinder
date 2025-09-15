import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteFacultyRequest {
  user_id?: string;
  email?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: user, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.user.id)
      .single();

    if (profileError || profile?.role !== 'cdc_director') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Only CDC Directors can delete faculty accounts' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    const body: DeleteFacultyRequest = await req.json();
    if (!body.user_id && !body.email) {
      return new Response(
        JSON.stringify({ error: 'user_id or email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    let targetUserId = body.user_id;
    if (!targetUserId && body.email) {
      const { data: targetUser, error: lookupError } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1,
        email: body.email,
      } as any);
      if (lookupError || !targetUser?.users?.length) {
        return new Response(
          JSON.stringify({ error: 'User not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
        );
      }
      targetUserId = targetUser.users[0].id;
    }

    // Delete auth user
    if (targetUserId) {
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
      if (deleteAuthError) {
        return new Response(
          JSON.stringify({ error: deleteAuthError.message }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
        );
      }
    }

    // Delete profile row as well (by user_id or id)
    if (targetUserId) {
      await supabaseAdmin.from('profiles').delete().eq('user_id', targetUserId);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  } catch (error: any) {
    console.error('Error in delete-faculty-account function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  }
};

serve(handler); 