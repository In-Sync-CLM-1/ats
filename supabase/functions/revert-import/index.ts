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

    // Verify the import belongs to the user and can be reverted
    const { data: importData, error: fetchError } = await supabaseAdmin
      .from('bulk_import_history')
      .select('id, user_id, table_name, status, can_revert, reverted_at')
      .eq('id', importId)
      .single();

    if (fetchError || !importData) {
      throw new Error('Import session not found');
    }

    if (importData.user_id !== user.id) {
      throw new Error('Unauthorized to revert this import');
    }

    if (!importData.can_revert) {
      throw new Error('This import cannot be reverted');
    }

    if (importData.reverted_at) {
      throw new Error('This import has already been reverted');
    }

    if (!['completed', 'partial'].includes(importData.status)) {
      throw new Error('Only completed or partial imports can be reverted');
    }

    // Get all records that were imported
    const { data: importedRecords, error: recordsError } = await supabaseAdmin
      .from('bulk_import_records')
      .select('record_id, table_name')
      .eq('import_id', importId);

    if (recordsError) {
      throw new Error(`Failed to fetch imported records: ${recordsError.message}`);
    }

    if (!importedRecords || importedRecords.length === 0) {
      throw new Error('No records found to revert');
    }

    console.log(`Reverting ${importedRecords.length} records from ${importData.table_name}`);

    // Delete records from target table (using admin client to bypass RLS)
    const recordIds = importedRecords.map(r => r.record_id);
    const tableName = importData.table_name;

    const { error: deleteError } = await supabaseAdmin
      .from(tableName)
      .delete()
      .in('id', recordIds);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      throw new Error(`Failed to delete records: ${deleteError.message}`);
    }

    // Mark import as reverted
    const { error: updateError } = await supabaseAdmin
      .from('bulk_import_history')
      .update({
        reverted_at: new Date().toISOString(),
        can_revert: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', importId);

    if (updateError) {
      console.warn('Failed to update import history:', updateError);
    }

    // Clean up bulk_import_records
    await supabaseAdmin
      .from('bulk_import_records')
      .delete()
      .eq('import_id', importId);

    console.log(`Successfully reverted import ${importId}: ${importedRecords.length} records deleted`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully reverted ${importedRecords.length} records`,
        deletedCount: importedRecords.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in revert-import:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
