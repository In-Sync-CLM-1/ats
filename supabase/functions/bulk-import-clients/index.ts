import { corsHeaders } from '../_shared/cors-headers.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ClientRecord {
  company_name?: string;
  contact_name?: string;
  contact_person_designation?: string;
  industry_sector?: string;
  email_id?: string;
  contact_number?: string;
}

interface ImportResult {
  imported: Array<{ row: number; company_name: string; email: string }>;
  failed: Array<{ row: number; company_name: string; email: string; error: string }>;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
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

    // Parse request body
    const { records } = await req.json();

    if (!Array.isArray(records) || records.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No records provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: ImportResult = {
      imported: [],
      failed: []
    };

    // Process each record
    for (let i = 0; i < records.length; i++) {
      const record: ClientRecord = records[i];
      const rowNumber = i + 2; // +2 for header row and 0-index

      try {
        // VALIDATION 1: company_name is mandatory
        if (!record.company_name?.trim()) {
          throw new Error('Missing required field: company_name');
        }

        // VALIDATION 2: email_id is mandatory
        if (!record.email_id?.trim()) {
          throw new Error('Missing required field: email_id');
        }

        // VALIDATION 3: email_id format check
        const email = record.email_id.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          throw new Error(`Invalid email format: ${email}`);
        }

        // VALIDATION 4: email_id must be unique
        const { data: existing } = await supabase
          .from('clients')
          .select('id')
          .eq('email_id', email)
          .maybeSingle();

        if (existing) {
          throw new Error(`Email already exists: ${email}`);
        }

        // Build client data - only include fields that are present
        const clientData: any = {
          company_name: record.company_name.trim(),
          email_id: email,
          created_by: user.id
        };

        // Add optional fields only if they have values
        if (record.contact_name?.trim()) {
          clientData.contact_name = record.contact_name.trim();
        }
        if (record.contact_person_designation?.trim()) {
          clientData.contact_person_designation = record.contact_person_designation.trim();
        }
        if (record.industry_sector?.trim()) {
          clientData.industry_sector = record.industry_sector.trim();
        }
        if (record.contact_number?.trim()) {
          clientData.contact_number = record.contact_number.trim();
        }

        // Insert into database
        const { data, error } = await supabase
          .from('clients')
          .insert(clientData)
          .select()
          .single();

        if (error) throw error;

        results.imported.push({
          row: rowNumber,
          company_name: record.company_name,
          email: email
        });

      } catch (error: any) {
        results.failed.push({
          row: rowNumber,
          company_name: record.company_name || '(missing)',
          email: record.email_id || '(missing)',
          error: error.message || 'Unknown error'
        });
      }
    }

    // Return results
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
