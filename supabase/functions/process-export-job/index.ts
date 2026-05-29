import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from '../_shared/cors-headers.ts';

const BATCH_SIZE = 500; // Process 500 records per batch
const RATE_LIMIT_DELAY = 500; // 500ms delay = 2 requests per second

// Sleep utility for rate limiting
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  try {
    const { jobId } = await req.json();

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: 'Job ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Processing export job: ${jobId}`);

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('export_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      console.error('Job not found:', jobError);
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Update job status to processing
    await supabase
      .from('export_jobs')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', jobId);

    const { source, filters } = job;

    // Column mapping
    const columnMap: Record<string, string[]> = {
      master: [
        'id', 'first_name', 'last_name', 'phone', 'phone_secondary', 'email',
        'position_applied_for', 'application_date', 'current_status', 'interview_stage',
        'recruitment_status', 'rating', 'current_company', 'designation',
        'total_experience_years', 'current_ctc_lakhs', 'expected_ctc_lakhs',
        'notice_period_days', 'highest_qualification', 'key_skills', 'languages',
        'linkedin_url', 'resume_url', 'address', 'current_location', 'preferred_location',
        'city', 'state', 'country', 'pincode', 'interview_dates', 'interview_feedback',
        'interviewer_names', 'rejection_reason', 'internal_notes', 'assigned_recruiter',
        'assigned_by', 'assigned_at', 'last_call_date', 'next_call_date',
        'latest_disposition', 'latest_subdisposition', 'source', 'created_by',
        'created_at', 'updated_at'
      ],
      clients: [
        'id', 'company_name', 'contact_name', 'contact_number', 'email_id', 'linkedin_id',
        'company_linkedin_page', 'official_address', 'residence_address', 'birthday_date',
        'anniversary_date', 'created_at', 'created_by', 'updated_at'
      ],
      demandcom: [
        'id', 'first_name', 'last_name', 'phone', 'phone_secondary', 'email',
        'position_applied_for', 'application_date', 'current_status', 'interview_stage',
        'recruitment_status', 'rating', 'current_company', 'designation',
        'total_experience_years', 'current_ctc_lakhs', 'expected_ctc_lakhs',
        'notice_period_days', 'highest_qualification', 'key_skills', 'languages',
        'linkedin_url', 'resume_url', 'address', 'current_location', 'preferred_location',
        'city', 'state', 'country', 'pincode', 'interview_dates', 'interview_feedback',
        'interviewer_names', 'rejection_reason', 'internal_notes', 'assigned_recruiter',
        'assigned_by', 'assigned_at', 'last_call_date', 'next_call_date',
        'latest_disposition', 'latest_subdisposition', 'source', 'created_by',
        'created_at', 'updated_at'
      ],
      mandates: [
        'id', 'job_title', 'mandate_id', 'job_description', 'client_id', 'mandate_status',
        'closure_reason', 'service_fee_percentage', 'mandatory_skills', 'preferred_skills',
        'job_location', 'locations', 'employment_type', 'work_mode', 'priority_level',
        'min_ctc_lakhs', 'max_ctc_lakhs', 'min_experience_years', 'max_experience_years',
        'number_of_positions', 'positions_filled', 'profiles_submitted', 'profiles_shortlisted', 'profiles_selected',
        'created_at', 'created_by', 'updated_at'
      ]
    };

    const allColumns = columnMap[source];

    // Build query with filters
    let query = supabase.from(source).select(allColumns.join(','), { count: 'exact' });
    query = applyFilters(query, filters, source);

    // Get total count
    const { count, error: countError } = await query;

    if (countError) {
      await supabase
        .from('export_jobs')
        .update({
          status: 'failed',
          error_message: countError.message,
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);
      
      return new Response(
        JSON.stringify({ error: 'Failed to count records' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const totalRecords = count || 0;
    console.log(`Total records to export: ${totalRecords}`);

    await supabase
      .from('export_jobs')
      .update({ total_records: totalRecords })
      .eq('id', jobId);

    if (totalRecords === 0) {
      await supabase
        .from('export_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);

      return new Response(
        JSON.stringify({ message: 'No records to export' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Header mapping for better CSV column names
    const headerMap: Record<string, string> = {
      'first_name': 'First Name',
      'last_name': 'Last Name',
      'phone': 'Phone Number',
      'phone_secondary': 'Secondary Phone',
      'email': 'Email',
      'position_applied_for': 'Position Applied For',
      'application_date': 'Application Date',
      'current_status': 'Current Status',
      'interview_stage': 'Interview Stage',
      'recruitment_status': 'Recruitment Status',
      'current_company': 'Current Company',
      'total_experience_years': 'Total Experience (Years)',
      'current_ctc_lakhs': 'Current CTC (Lakhs)',
      'expected_ctc_lakhs': 'Expected CTC (Lakhs)',
      'notice_period_days': 'Notice Period (Days)',
      'highest_qualification': 'Highest Qualification',
      'key_skills': 'Key Skills',
      'linkedin_url': 'LinkedIn URL',
      'resume_url': 'Resume URL',
      'current_location': 'Current Location',
      'preferred_location': 'Preferred Location',
      'interview_dates': 'Interview Dates',
      'interview_feedback': 'Interview Feedback',
      'interviewer_names': 'Interviewer Names',
      'rejection_reason': 'Rejection Reason',
      'internal_notes': 'Internal Notes',
      'assigned_recruiter': 'Assigned Recruiter',
      'assigned_by': 'Assigned By',
      'assigned_at': 'Assigned At',
      'last_call_date': 'Last Call Date',
      'next_call_date': 'Next Call Date',
      'latest_disposition': 'Latest Disposition',
      'latest_subdisposition': 'Latest Subdisposition',
      'company_linkedin_page': 'Company LinkedIn Page',
      'linkedin_id': 'LinkedIn ID',
      'email_id': 'Email ID'
    };

    const headers = allColumns.map(col => {
      if (headerMap[col]) return headerMap[col];
      return col.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    });
    
    let csvContent = headers.join(',') + '\n';
    let processedRecords = 0;

    // Process in batches with rate limiting
    for (let offset = 0; offset < totalRecords; offset += BATCH_SIZE) {
      const to = Math.min(offset + BATCH_SIZE - 1, totalRecords - 1);
      
      console.log(`Fetching batch: ${offset} to ${to}`);

      // Apply rate limiting (500ms delay = 2 requests per second)
      if (offset > 0) {
        await sleep(RATE_LIMIT_DELAY);
      }

      let batchQuery = supabase.from(source).select(allColumns.join(','));
      batchQuery = applyFilters(batchQuery, filters, source);
      batchQuery = batchQuery.range(offset, to);

      const { data: records, error: batchError } = await batchQuery;

      if (batchError) {
        console.error('Error fetching batch:', batchError);
        await supabase
          .from('export_jobs')
          .update({
            status: 'failed',
            error_message: batchError.message,
            completed_at: new Date().toISOString()
          })
          .eq('id', jobId);
        
        return new Response(
          JSON.stringify({ error: 'Failed to fetch batch' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      // Add records to CSV
      for (const record of records || []) {
        const row = allColumns.map(col => {
          const value = (record as Record<string, any>)[col];
          if (value === null || value === undefined) return '';
          const stringValue = String(value);
          return stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')
            ? `"${stringValue.replace(/"/g, '""')}"`
            : stringValue;
        });
        csvContent += row.join(',') + '\n';
      }

      processedRecords += records?.length || 0;

      // Update progress
      await supabase
        .from('export_jobs')
        .update({ processed_records: processedRecords })
        .eq('id', jobId);

      console.log(`Processed ${processedRecords} of ${totalRecords} records`);
    }

    // Upload to storage
    const fileName = `export-${source}-${jobId}-${Date.now()}.csv`;
    const { error: uploadError } = await supabase.storage
      .from('bulk-imports')
      .upload(fileName, csvContent, {
        contentType: 'text/csv',
        upsert: false
      });

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      await supabase
        .from('export_jobs')
        .update({
          status: 'failed',
          error_message: uploadError.message,
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);
      
      return new Response(
        JSON.stringify({ error: 'Failed to upload file' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Get signed URL (valid for 1 hour)
    const { data: urlData, error: urlError } = await supabase.storage
      .from('bulk-imports')
      .createSignedUrl(fileName, 3600);

    if (urlError) {
      console.error('Error creating signed URL:', urlError);
      await supabase
        .from('export_jobs')
        .update({
          status: 'failed',
          error_message: urlError.message,
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);
      
      return new Response(
        JSON.stringify({ error: 'Failed to create download URL' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Mark job as completed
    await supabase
      .from('export_jobs')
      .update({
        status: 'completed',
        file_url: urlData.signedUrl,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

    console.log(`Export job ${jobId} completed successfully`);

    return new Response(
      JSON.stringify({ 
        message: 'Export completed successfully',
        fileUrl: urlData.signedUrl
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// Helper function to apply filters
function applyFilters(query: any, filters: any, source: string) {
  if (!filters) return query;

  // Text filters
  if (filters.name?.value) {
    if (source === 'clients') {
      const nameField = 'contact_name';
      if (filters.name.operator === 'contains') query = query.ilike(nameField, `%${filters.name.value}%`);
      else if (filters.name.operator === 'equals') query = query.eq(nameField, filters.name.value);
      else if (filters.name.operator === 'starts_with') query = query.ilike(nameField, `${filters.name.value}%`);
    } else if (source === 'mandates') {
      const nameField = 'job_title';
      if (filters.name.operator === 'contains') query = query.ilike(nameField, `%${filters.name.value}%`);
      else if (filters.name.operator === 'equals') query = query.eq(nameField, filters.name.value);
      else if (filters.name.operator === 'starts_with') query = query.ilike(nameField, `${filters.name.value}%`);
    } else if (source === 'master' || source === 'demandcom') {
      // For ATS, search in both first_name and last_name
      if (filters.name.operator === 'contains') {
        query = query.or(`first_name.ilike.%${filters.name.value}%,last_name.ilike.%${filters.name.value}%`);
      } else if (filters.name.operator === 'equals') {
        query = query.or(`first_name.eq.${filters.name.value},last_name.eq.${filters.name.value}`);
      } else if (filters.name.operator === 'starts_with') {
        query = query.or(`first_name.ilike.${filters.name.value}%,last_name.ilike.${filters.name.value}%`);
      }
    }
  }

  if (filters.mobile?.value && (source === 'master' || source === 'demandcom')) {
    if (filters.mobile.operator === 'contains') query = query.ilike('phone', `%${filters.mobile.value}%`);
    else if (filters.mobile.operator === 'equals') query = query.eq('phone', filters.mobile.value);
    else if (filters.mobile.operator === 'starts_with') query = query.ilike('phone', `${filters.mobile.value}%`);
  }

  if (filters.email?.value) {
    if (source === 'master' || source === 'demandcom') {
      if (filters.email.operator === 'contains') {
        query = query.ilike('email', `%${filters.email.value}%`);
      }
    } else if (source === 'clients') {
      if (filters.email.operator === 'contains') {
        query = query.ilike('email_id', `%${filters.email.value}%`);
      }
    }
  }

  if (filters.company?.value) {
    if (source === 'master' || source === 'demandcom') {
      if (filters.company.operator === 'contains') query = query.ilike('current_company', `%${filters.company.value}%`);
      else if (filters.company.operator === 'equals') query = query.eq('current_company', filters.company.value);
      else if (filters.company.operator === 'starts_with') query = query.ilike('current_company', `${filters.company.value}%`);
    } else if (source === 'clients') {
      if (filters.company.operator === 'contains') query = query.ilike('company_name', `%${filters.company.value}%`);
      else if (filters.company.operator === 'equals') query = query.eq('company_name', filters.company.value);
      else if (filters.company.operator === 'starts_with') query = query.ilike('company_name', `${filters.company.value}%`);
    }
  }

  // Multi-select filters (ATS-specific)
  if (filters.city?.length > 0) query = query.in('city', filters.city);
  if (filters.state?.length > 0) query = query.in('state', filters.state);
  if (filters.designation?.length > 0 && (source === 'master' || source === 'demandcom')) {
    query = query.in('designation', filters.designation);
  }
  if (filters.currentStatus?.length > 0 && (source === 'master' || source === 'demandcom')) {
    query = query.in('current_status', filters.currentStatus);
  }
  if (filters.recruitmentStatus?.length > 0 && (source === 'master' || source === 'demandcom')) {
    query = query.in('recruitment_status', filters.recruitmentStatus);
  }
  if (filters.interviewStage?.length > 0 && (source === 'master' || source === 'demandcom')) {
    query = query.in('interview_stage', filters.interviewStage);
  }
  if (filters.disposition?.length > 0 && source === 'demandcom') {
    if (filters.disposition.length >= 10) {
      const quotedValues = filters.disposition.map((d: string) => `"${d}"`).join(',');
      query = query.or(`latest_disposition.in.(${quotedValues}),latest_disposition.is.null`);
    } else {
      query = query.in('latest_disposition', filters.disposition);
    }
  }
  if (filters.subdisposition?.length > 0 && source === 'demandcom') {
    if (filters.subdisposition.length >= 20) {
      const quotedValues = filters.subdisposition.map((s: string) => `"${s}"`).join(',');
      query = query.or(`latest_subdisposition.in.(${quotedValues}),latest_subdisposition.is.null`);
    } else {
      query = query.in('latest_subdisposition', filters.subdisposition);
    }
  }
  if (filters.source?.length > 0 && source === 'demandcom') {
    query = query.in('source', filters.source);
  }
  if (filters.mandateStatus?.length > 0 && source === 'mandates') {
    query = query.in('mandate_status', filters.mandateStatus);
  }

  // Additional text filters (ATS-specific)
  if (filters.mobile2?.value && (source === 'master' || source === 'demandcom')) {
    if (filters.mobile2.operator === 'contains') query = query.ilike('phone_secondary', `%${filters.mobile2.value}%`);
    else if (filters.mobile2.operator === 'equals') query = query.eq('phone_secondary', filters.mobile2.value);
    else if (filters.mobile2.operator === 'starts_with') query = query.ilike('phone_secondary', `${filters.mobile2.value}%`);
  }

  if (filters.linkedin?.value && (source === 'master' || source === 'demandcom')) {
    if (filters.linkedin.operator === 'contains') query = query.ilike('linkedin_url', `%${filters.linkedin.value}%`);
    else if (filters.linkedin.operator === 'equals') query = query.eq('linkedin_url', filters.linkedin.value);
    else if (filters.linkedin.operator === 'starts_with') query = query.ilike('linkedin_url', `${filters.linkedin.value}%`);
  }

  if (filters.location?.value && (source === 'master' || source === 'demandcom')) {
    if (filters.location.operator === 'contains') {
      query = query.or(`current_location.ilike.%${filters.location.value}%,preferred_location.ilike.%${filters.location.value}%`);
    } else if (filters.location.operator === 'equals') {
      query = query.or(`current_location.eq.${filters.location.value},preferred_location.eq.${filters.location.value}`);
    } else if (filters.location.operator === 'starts_with') {
      query = query.or(`current_location.ilike.${filters.location.value}%,preferred_location.ilike.${filters.location.value}%`);
    }
  }

  // Date range filters
  if (filters.createdDate?.from) query = query.gte('created_at', filters.createdDate.from);
  if (filters.createdDate?.to) query = query.lte('created_at', filters.createdDate.to);
  if (filters.lastCallDate?.from && (source === 'master' || source === 'demandcom')) {
    query = query.gte('last_call_date', filters.lastCallDate.from);
  }
  if (filters.lastCallDate?.to && (source === 'master' || source === 'demandcom')) {
    query = query.lte('last_call_date', filters.lastCallDate.to);
  }
  if (filters.nextCallDate?.from && (source === 'master' || source === 'demandcom')) {
    query = query.gte('next_call_date', filters.nextCallDate.from);
  }
  if (filters.nextCallDate?.to && (source === 'master' || source === 'demandcom')) {
    query = query.lte('next_call_date', filters.nextCallDate.to);
  }

  return query;
}
