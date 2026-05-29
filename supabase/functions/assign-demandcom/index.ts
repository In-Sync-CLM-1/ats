import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from '../_shared/cors-headers.ts';

interface AssignmentRequest {
  assignedTo: string;
  recordIds: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create client with user's auth
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Authenticated user:', user.id);

    const { assignedTo, recordIds }: AssignmentRequest = await req.json();

    if (!assignedTo) {
      return new Response(JSON.stringify({ error: 'assignedTo is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!recordIds || recordIds.length === 0) {
      return new Response(JSON.stringify({ error: 'recordIds are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify assignee exists
    const { data: assigneeProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', assignedTo)
      .single();

    if (profileError || !assigneeProfile) {
      console.error('Assignee not found:', profileError);
      return new Response(JSON.stringify({ error: 'Invalid assignee user' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Assigning to user:', assigneeProfile.full_name);
    console.log(`Assigning ${recordIds.length} selected records`);
    const { error: updateError } = await supabase
      .from('candidates')
      .update({
        assigned_recruiter: assignedTo,
        assigned_by: user.id,
        assigned_at: new Date().toISOString(),
        recruitment_status: 'assigned',
      })
      .in('id', recordIds);

    if (updateError) {
      console.error('Error updating records:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to assign records' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Successfully assigned ${recordIds.length} records to ${assigneeProfile.full_name}`);

    return new Response(JSON.stringify({ 
      successCount: recordIds.length,
      message: `Successfully assigned ${recordIds.length} record(s) to ${assigneeProfile.full_name}`,
      assigneeName: assigneeProfile.full_name,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
