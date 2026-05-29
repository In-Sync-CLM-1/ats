import { corsHeaders } from '../_shared/cors-headers.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

interface MandateRecord {
  job_title: string;
  client_id: string;
  minimum_qualification: string;
  job_description: string;
  job_location: string;
  min_experience_years?: number;
  max_experience_years?: number;
  min_ctc_lakhs?: number;
  max_ctc_lakhs?: number;
  notice_period_acceptable?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { records } = await req.json();

    if (!Array.isArray(records) || records.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No records provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const MAX_BATCH_SIZE = 50;
    if (records.length > MAX_BATCH_SIZE) {
      return new Response(
        JSON.stringify({ 
          error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} records. Please split into smaller batches.`,
          success: false 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing batch of ${records.length} mandates for user ${user.id}`);

    const results: {
      imported: Array<{ row: number; job_title: string; client_id: string }>;
      failed: Array<{ row: number; job_title: string; client_name: string; error: string }>;
    } = {
      imported: [],
      failed: []
    };

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + 3;

      try {
        if (!record.job_title?.trim()) {
          throw new Error('Missing required field: job_title');
        }
        if (!record.client_id?.trim()) {
          throw new Error('Missing required field: client_id');
        }
        if (!record.minimum_qualification?.trim()) {
          throw new Error('Missing required field: minimum_qualification');
        }
        if (!record.job_description?.trim()) {
          throw new Error('Missing required field: job_description');
        }
        if (!record.job_location?.trim()) {
          throw new Error('Missing required field: job_location');
        }

        const { data: clientExists, error: clientError } = await supabase
          .from('clients')
          .select('id')
          .eq('id', record.client_id)
          .maybeSingle();

        if (clientError || !clientExists) {
          throw new Error(`Client not found with ID: ${record.client_id}`);
        }

        const mandateData: any = {
          job_title: record.job_title.trim(),
          client_id: record.client_id,
          minimum_qualification: record.minimum_qualification.trim(),
          job_description: record.job_description.trim(),
          job_location: record.job_location.trim(),
          created_by: user.id,
          mandate_status: 'open',
          priority_level: 'medium',
          number_of_positions: 1,
          employment_type: 'permanent',
          work_mode: 'office'
        };

        // Simply convert optional fields to numbers with defaults
        mandateData.min_experience_years = Number(record.min_experience_years) || 0;
        mandateData.max_experience_years = Number(record.max_experience_years) || 0;
        mandateData.min_ctc_lakhs = Number(record.min_ctc_lakhs) || 0;
        mandateData.max_ctc_lakhs = Number(record.max_ctc_lakhs) || 0;
        mandateData.notice_period_acceptable = Number(record.notice_period_acceptable) || 30;

        const { data, error } = await supabase
          .from('mandates')
          .insert(mandateData)
          .select()
          .single();

        if (error) throw error;

        results.imported.push({
          row: rowNumber,
          job_title: record.job_title,
          client_id: record.client_id
        });

      } catch (error: any) {
        results.failed.push({
          row: rowNumber,
          job_title: record.job_title || '(missing)',
          client_name: record.client_name || '(missing)',
          error: error.message || 'Unknown error'
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: records.length,
        imported: results.imported.length,
        failed: results.failed.length,
        failedRecords: results.failed
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Bulk import error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
