import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STAGING_BATCH_SIZE = 5000;

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

    const { importId, records, tableName } = await req.json();

    if (!importId || !records || !tableName) {
      throw new Error('Missing required fields: importId, records, tableName');
    }

    console.log(`Processing ${records.length} records for import ${importId} into ${tableName}`);

    // Use service role for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Update import status to processing
    await supabaseAdmin
      .from('bulk_import_history')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', importId);

    // Insert records into staging table in batches
    const stagingRecords = records.map((record: Record<string, unknown>, index: number) => ({
      import_id: importId,
      row_number: index + 1,
      raw_data: record,
      processed: false
    }));

    // Insert in chunks to avoid payload limits
    for (let i = 0; i < stagingRecords.length; i += STAGING_BATCH_SIZE) {
      const chunk = stagingRecords.slice(i, i + STAGING_BATCH_SIZE);
      const { error: stagingError } = await supabaseAdmin
        .from('import_staging')
        .insert(chunk);

      if (stagingError) {
        console.error('Staging insert error:', stagingError);
        throw new Error(`Failed to stage records: ${stagingError.message}`);
      }
      console.log(`Staged ${Math.min(i + STAGING_BATCH_SIZE, stagingRecords.length)}/${stagingRecords.length} records`);
    }

    // Call PostgreSQL function to process the batch
    const { data: result, error: rpcError } = await supabaseAdmin
      .rpc('process_bulk_import_batch', {
        p_import_id: importId,
        p_table_name: tableName,
        p_user_id: user.id
      });

    if (rpcError) {
      console.error('RPC error:', rpcError);
      
      // Update status to failed
      await supabaseAdmin
        .from('bulk_import_history')
        .update({ 
          status: 'failed', 
          error_log: [{ error: rpcError.message }],
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', importId);

      throw new Error(`Processing failed: ${rpcError.message}`);
    }

    console.log(`Processing complete:`, result);

    // Clean up staging table
    const { error: cleanupError } = await supabaseAdmin
      .from('import_staging')
      .delete()
      .eq('import_id', importId);

    if (cleanupError) {
      console.warn('Staging cleanup warning:', cleanupError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-import-hybrid:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
