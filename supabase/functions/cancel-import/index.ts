import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { importId } = await req.json();

    if (!importId) {
      throw new Error('Missing required field: importId');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the import belongs to the user
    const { data: importData, error: fetchError } = await supabaseAdmin
      .from('bulk_import_history')
      .select('id, user_id, status')
      .eq('id', importId)
      .single();

    if (fetchError || !importData) {
      throw new Error('Import session not found');
    }

    if (importData.user_id !== user.id) {
      throw new Error('Unauthorized to cancel this import');
    }

    if (!['pending', 'processing'].includes(importData.status)) {
      throw new Error('Import cannot be cancelled in current status');
    }

    // Update status to cancelled
    const { error: updateError } = await supabaseAdmin
      .from('bulk_import_history')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', importId);

    if (updateError) {
      throw new Error(`Failed to cancel import: ${updateError.message}`);
    }

    // Clean up any staging data
    await supabaseAdmin
      .from('import_staging')
      .delete()
      .eq('import_id', importId);

    console.log(`Import ${importId} cancelled by user ${user.id}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Import cancelled successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in cancel-import:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
