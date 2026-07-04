import { corsHeaders } from '../_shared/cors-headers.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface CandidateRecord {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  position_applied_for?: string;
  current_status?: string;
  total_experience_years?: string;
  expected_ctc_lakhs?: string;
  notice_period_days?: string;
  assigned_recruiter?: string;
}

interface ImportResult {
  imported: Array<{ row: number; first_name: string; email: string }>;
  failed: Array<{ row: number; first_name: string; email: string; error: string }>;
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

    // Validate batch size (prevent overload)
    const MAX_BATCH_SIZE = 500;
    if (records.length > MAX_BATCH_SIZE) {
      return new Response(
        JSON.stringify({ 
          error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} records. Please split into smaller batches.`,
          success: false 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing batch of ${records.length} records for user ${user.id}`);

    const results: ImportResult = {
      imported: [],
      failed: []
    };

    // Process each record
    for (let i = 0; i < records.length; i++) {
      const record: CandidateRecord = records[i];
      const rowNumber = i + 2; // +2 for header row and 0-index

      try {
        // VALIDATION 1: first_name is mandatory
        if (!record.first_name?.trim()) {
          throw new Error('Missing required field: first_name');
        }

        // VALIDATION 2: email is mandatory
        if (!record.email?.trim()) {
          throw new Error('Missing required field: email');
        }

        // VALIDATION 3: email format check
        const email = record.email.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          throw new Error(`Invalid email format: ${email}`);
        }

        // VALIDATION 4: email must be unique
        const { data: existingEmail } = await supabase
          .from('candidates')
          .select('id')
          .eq('email', email)
          .maybeSingle();

        if (existingEmail) {
          throw new Error(`Email already exists: ${email}`);
        }

        // VALIDATION 5: phone is mandatory and must be 10 digits
        if (!record.phone?.trim()) {
          throw new Error('Missing required field: phone');
        }
        const phone = record.phone.trim().replace(/\D/g, ''); // Remove non-digits
        if (phone.length !== 10) {
          throw new Error(`Phone must be exactly 10 digits, got: ${phone}`);
        }

        // VALIDATION 6: phone must be unique too — same person, different email
        // is the most common duplicate shape in bulk files
        const { data: existingPhone } = await supabase
          .from('candidates')
          .select('id, first_name, last_name')
          .eq('phone', phone)
          .maybeSingle();

        if (existingPhone) {
          throw new Error(`Phone already exists: ${phone} (${existingPhone.first_name} ${existingPhone.last_name})`);
        }

        // Build candidate data
        const candidateData: any = {
          first_name: record.first_name.trim(),
          last_name: record.last_name?.trim() || '',
          email: email,
          phone: phone,
          position_applied_for: record.position_applied_for?.trim() || 'Not Specified',
          current_status: record.current_status?.trim() || 'applied',
          created_by: user.id
        };

        // OPTIONAL: total_experience_years - convert to number
        if (record.total_experience_years?.trim()) {
          const exp = parseFloat(record.total_experience_years.trim());
          if (!isNaN(exp) && exp >= 0) {
            candidateData.total_experience_years = exp;
          }
        }

        // OPTIONAL: expected_ctc_lakhs - convert to number
        if (record.expected_ctc_lakhs?.trim()) {
          const ctc = parseFloat(record.expected_ctc_lakhs.trim());
          if (!isNaN(ctc) && ctc >= 0) {
            candidateData.expected_ctc_lakhs = ctc;
          }
        }

        // OPTIONAL: notice_period_days - convert to integer
        if (record.notice_period_days?.trim()) {
          const days = parseInt(record.notice_period_days.trim());
          if (!isNaN(days) && days >= 0) {
            candidateData.notice_period_days = days;
          }
        }

        // OPTIONAL: assigned_recruiter - lookup by email
        if (record.assigned_recruiter?.trim()) {
          const recruiterEmail = record.assigned_recruiter.trim();
          const { data: recruiter } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', recruiterEmail)
            .maybeSingle();
          
          if (recruiter) {
            candidateData.assigned_recruiter = recruiter.id;
            candidateData.assigned_by = user.id;
            candidateData.assigned_at = new Date().toISOString();
          } else {
            console.warn(`Recruiter not found for email: ${recruiterEmail}`);
          }
        }

        // Insert into database
        const { data, error } = await supabase
          .from('candidates')
          .insert(candidateData)
          .select()
          .single();

        if (error) throw error;

        results.imported.push({
          row: rowNumber,
          first_name: record.first_name,
          email: email
        });

      } catch (error: any) {
        const rawMessage = error.message || 'Unknown error';
        let friendlyMessage = rawMessage;

        if (rawMessage.includes('demandcom_phone_unique')) {
          friendlyMessage = 'Phone number already exists for another candidate';
        } else if (rawMessage.includes('demandcom_email_unique')) {
          friendlyMessage = 'Email already exists for another candidate';
        }

        results.failed.push({
          row: rowNumber,
          first_name: record.first_name || '(missing)',
          email: record.email || '(missing)',
          error: friendlyMessage,
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
