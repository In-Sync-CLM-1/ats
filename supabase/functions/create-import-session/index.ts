import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_RECORDS = 500000;
const BATCH_SIZE = 5000;

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

    const { tableName, fileName, totalRecords } = await req.json();

    if (!tableName || !fileName || !totalRecords) {
      throw new Error('Missing required fields: tableName, fileName, totalRecords');
    }

    if (totalRecords > MAX_RECORDS) {
      throw new Error(`Maximum ${MAX_RECORDS} records allowed per import`);
    }

    const totalBatches = Math.ceil(totalRecords / BATCH_SIZE);

    // Create import session using service role for reliability
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: importSession, error: insertError } = await supabaseAdmin
      .from('bulk_import_history')
      .insert({
        user_id: user.id,
        table_name: tableName,
        file_name: fileName,
        total_records: totalRecords,
        total_batches: totalBatches,
        status: 'pending',
        processed_records: 0,
        successful_records: 0,
        failed_records: 0,
        error_log: [],
        can_revert: true
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw new Error(`Failed to create import session: ${insertError.message}`);
    }

    console.log(`Created import session ${importSession.id} for ${totalRecords} records in ${totalBatches} batches`);

    return new Response(
      JSON.stringify({
        success: true,
        importId: importSession.id,
        totalBatches,
        batchSize: BATCH_SIZE
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-import-session:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
