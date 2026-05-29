import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FUNCTION_VERSION = '3.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`[FUNCTION_VERSION] Running admin-create-user v${FUNCTION_VERSION}`);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: callingUser }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !callingUser) throw new Error('Unauthorized');

    console.log('[AUTH] User creation request from:', callingUser.email);

    const { data: roles, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callingUser.id);

    if (roleError) throw new Error('Failed to verify permissions');

    const userRoles = roles?.map((r: any) => r.role) || [];
    const allowedRoles = ['platform_admin', 'super_admin', 'admin_administration', 'admin_tech', 'admin'];
    if (!userRoles.some((role: string) => allowedRoles.includes(role))) {
      throw new Error('Insufficient permissions to create users');
    }

    const { email, password, full_name, role, designation_id, reports_to, team_id, phone, org_id: requestedOrgId } = await req.json();

    // Resolve org_id: use provided org_id or fall back to caller's org
    let orgId = requestedOrgId;
    if (!orgId) {
      const { data: callerMembership } = await supabaseAdmin
        .from('org_memberships')
        .select('org_id')
        .eq('user_id', callingUser.id)
        .limit(1)
        .single();
      orgId = callerMembership?.org_id;
    }

    console.log('Creating user:', email, 'with role:', role, 'in org:', orgId);

    // Create auth user
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    });

    if (createError) throw createError;
    console.log('User created:', userData.user.id);

    // Remove auto-assigned default role
    await supabaseAdmin.from('user_roles').delete().eq('user_id', userData.user.id);

    // Assign selected role with org_id
    const { error: roleInsertError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: userData.user.id, role, org_id: orgId });

    if (roleInsertError) throw new Error('Failed to assign role: ' + roleInsertError.message);

    // Add to org_memberships
    if (orgId) {
      const membershipRole = userRoles.includes('platform_admin') && ['admin', 'super_admin', 'admin_administration', 'admin_tech'].includes(role)
        ? 'org_admin'
        : 'member';

      await supabaseAdmin.from('org_memberships').insert({
        org_id: orgId,
        user_id: userData.user.id,
        role: membershipRole
      });

      // Set org_id on profile
      await supabaseAdmin.from('profiles').update({ org_id: orgId }).eq('id', userData.user.id);
    }

    // Assign designation if provided
    if (designation_id) {
      await supabaseAdmin.from('user_designations').insert({
        user_id: userData.user.id,
        designation_id,
        assigned_by: callingUser.id,
        org_id: orgId
      });
    }

    // Update profile
    const profileUpdates: Record<string, any> = {};
    if (reports_to) profileUpdates.reports_to = reports_to;
    if (phone) profileUpdates.phone = phone;
    if (Object.keys(profileUpdates).length > 0) {
      await supabaseAdmin.from('profiles').update(profileUpdates).eq('id', userData.user.id);
    }

    // Assign to team if provided
    if (team_id) {
      await supabaseAdmin.from('team_members').insert({
        user_id: userData.user.id,
        team_id,
        role_in_team: 'member',
        org_id: orgId
      });
    }

    console.log('User setup completed');

    return new Response(
      JSON.stringify({ success: true, user: userData.user }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
