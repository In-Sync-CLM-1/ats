import { createAuthenticatedClient } from '../_shared/supabase-client.ts';
import { corsHeaders, handleCorsPreflightRequest } from '../_shared/cors-headers.ts';
import { verifyAuth } from '../_shared/auth-helpers.ts';
import { errorResponse } from '../_shared/response-helpers.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest();
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const { authenticated, error: authError } = await verifyAuth(authHeader);

    if (!authenticated) {
      return errorResponse(authError || 'Unauthorized', 401);
    }

    const supabase = createAuthenticatedClient(authHeader!);
    
    const { source, filters } = await req.json();

    if (!source) {
      return errorResponse('Data source is required', 400);
    }

    console.log(`Starting export for source: ${source}`);
    console.log('Applied filters:', JSON.stringify(filters, null, 2));

    // Define base columns and profile joins for each source
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
    if (!allColumns) {
      return errorResponse('Invalid data source', 400);
    }

    // Build query with filters
    let query = supabase.from(source).select(allColumns.join(','), { count: 'exact' });

    // Apply filters
    if (filters) {
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
        if (filters.mobile.operator === 'contains') {
          query = query.ilike('phone', `%${filters.mobile.value}%`);
        } else if (filters.mobile.operator === 'equals') {
          query = query.eq('phone', filters.mobile.value);
        } else if (filters.mobile.operator === 'starts_with') {
          query = query.ilike('phone', `${filters.mobile.value}%`);
        }
      }

      if (filters.email?.value) {
        if (source === 'master' || source === 'demandcom') {
          // For ATS, just use the email field
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
          // For ATS, use current_company
          if (filters.company.operator === 'contains') {
            query = query.ilike('current_company', `%${filters.company.value}%`);
          } else if (filters.company.operator === 'equals') {
            query = query.eq('current_company', filters.company.value);
          } else if (filters.company.operator === 'starts_with') {
            query = query.ilike('current_company', `${filters.company.value}%`);
          }
        } else if (source === 'clients') {
          if (filters.company.operator === 'contains') {
            query = query.ilike('company_name', `%${filters.company.value}%`);
          } else if (filters.company.operator === 'equals') {
            query = query.eq('company_name', filters.company.value);
          } else if (filters.company.operator === 'starts_with') {
            query = query.ilike('company_name', `${filters.company.value}%`);
          }
        }
      }

      // Multi-select filters (ATS-specific for master/demandcom)
      if (filters.city?.length > 0) {
        query = query.in('city', filters.city);
      }
      if (filters.state?.length > 0) {
        query = query.in('state', filters.state);
      }
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
        query = query.in('latest_disposition', filters.disposition);
      }
      if (filters.source?.length > 0 && source === 'demandcom') {
        query = query.in('source', filters.source);
      }
      if (filters.mandateStatus?.length > 0 && source === 'mandates') {
        query = query.in('mandate_status', filters.mandateStatus);
      }

      // Additional text filters (ATS-specific)
      if (filters.mobile2?.value && (source === 'master' || source === 'demandcom')) {
        if (filters.mobile2.operator === 'contains') {
          query = query.ilike('phone_secondary', `%${filters.mobile2.value}%`);
        } else if (filters.mobile2.operator === 'equals') {
          query = query.eq('phone_secondary', filters.mobile2.value);
        } else if (filters.mobile2.operator === 'starts_with') {
          query = query.ilike('phone_secondary', `${filters.mobile2.value}%`);
        }
      }

      if (filters.linkedin?.value && (source === 'master' || source === 'demandcom')) {
        if (filters.linkedin.operator === 'contains') {
          query = query.ilike('linkedin_url', `%${filters.linkedin.value}%`);
        } else if (filters.linkedin.operator === 'equals') {
          query = query.eq('linkedin_url', filters.linkedin.value);
        } else if (filters.linkedin.operator === 'starts_with') {
          query = query.ilike('linkedin_url', `${filters.linkedin.value}%`);
        }
      }

      if (filters.location?.value && (source === 'master' || source === 'demandcom')) {
        // Search in both current_location and preferred_location
        if (filters.location.operator === 'contains') {
          query = query.or(`current_location.ilike.%${filters.location.value}%,preferred_location.ilike.%${filters.location.value}%`);
        } else if (filters.location.operator === 'equals') {
          query = query.or(`current_location.eq.${filters.location.value},preferred_location.eq.${filters.location.value}`);
        } else if (filters.location.operator === 'starts_with') {
          query = query.or(`current_location.ilike.${filters.location.value}%,preferred_location.ilike.${filters.location.value}%`);
        }
      }

      if (filters.address?.value && (source === 'master' || source === 'demandcom')) {
        if (filters.address.operator === 'contains') {
          query = query.ilike('address', `%${filters.address.value}%`);
        } else if (filters.address.operator === 'equals') {
          query = query.eq('address', filters.address.value);
        } else if (filters.address.operator === 'starts_with') {
          query = query.ilike('address', `${filters.address.value}%`);
        }
      }

      if (filters.pincode?.value && (source === 'master' || source === 'demandcom')) {
        if (filters.pincode.operator === 'contains') {
          query = query.ilike('pincode', `%${filters.pincode.value}%`);
        } else if (filters.pincode.operator === 'equals') {
          query = query.eq('pincode', filters.pincode.value);
        } else if (filters.pincode.operator === 'starts_with') {
          query = query.ilike('pincode', `${filters.pincode.value}%`);
        }
      }

      // Date range filters
      if (filters.createdDate?.from) {
        query = query.gte('created_at', filters.createdDate.from);
      }
      if (filters.createdDate?.to) {
        query = query.lte('created_at', filters.createdDate.to);
      }
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
      if (filters.birthdayDate?.from && source === 'clients') {
        query = query.gte('birthday_date', filters.birthdayDate.from);
      }
      if (filters.birthdayDate?.to && source === 'clients') {
        query = query.lte('birthday_date', filters.birthdayDate.to);
      }
      if (filters.anniversaryDate?.from && source === 'clients') {
        query = query.gte('anniversary_date', filters.anniversaryDate.from);
      }
      if (filters.anniversaryDate?.to && source === 'clients') {
        query = query.lte('anniversary_date', filters.anniversaryDate.to);
      }
    }

    // Get total count with filters applied
    const { count, error: countError } = await query;

    if (countError) {
      console.error('Error counting filtered records:', countError);
      return errorResponse('Failed to count filtered records', 500, countError);
    }

    const totalRecords = count || 0;
    console.log(`Total filtered records to export: ${totalRecords}`);

    if (totalRecords === 0) {
      return errorResponse('No records found matching the filters', 404);
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

    // Create CSV header with proper formatting
    const headers = allColumns.map(col => {
      if (headerMap[col]) return headerMap[col];
      return col.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    });
    let csvContent = headers.join(',') + '\n';

    // Process in batches of 1000 (Supabase default max page size limit)
    const batchSize = 1000;
    let processedRecords = 0;

    for (let offset = 0; offset < totalRecords; offset += batchSize) {
      const to = Math.min(offset + batchSize - 1, totalRecords - 1);
      
      console.log(`Fetching batch: ${offset} to ${to}`);
      
      // Rebuild query with same filters for each batch
      let batchQuery = supabase.from(source).select(allColumns.join(','));
      
      // Reapply all filters (same as above)
      if (filters) {
        if (filters.name?.value) {
          const nameField = source === 'clients' ? 'contact_name' : source === 'mandates' ? 'job_title' : 'name';
          if (filters.name.operator === 'contains') batchQuery = batchQuery.ilike(nameField, `%${filters.name.value}%`);
          else if (filters.name.operator === 'equals') batchQuery = batchQuery.eq(nameField, filters.name.value);
          else if (filters.name.operator === 'starts_with') batchQuery = batchQuery.ilike(nameField, `${filters.name.value}%`);
        }
        if (filters.mobile?.value && (source === 'master' || source === 'demandcom')) {
          if (filters.mobile.operator === 'contains') batchQuery = batchQuery.ilike('mobile_numb', `%${filters.mobile.value}%`);
          else if (filters.mobile.operator === 'equals') batchQuery = batchQuery.eq('mobile_numb', filters.mobile.value);
          else if (filters.mobile.operator === 'starts_with') batchQuery = batchQuery.ilike('mobile_numb', `${filters.mobile.value}%`);
        }
        if (filters.email?.value) {
          const emailFields = source === 'master' || source === 'demandcom' 
            ? ['official', 'personal_email_id', 'generic_email_id']
            : source === 'clients' ? ['email_id'] : [];
          if (emailFields.length > 0 && filters.email.operator === 'contains') {
            const orConditions = emailFields.map(field => `${field}.ilike.%${filters.email.value}%`).join(',');
            batchQuery = batchQuery.or(orConditions);
          }
        }
        if (filters.company?.value && (source === 'master' || source === 'demandcom' || source === 'clients')) {
          if (filters.company.operator === 'contains') batchQuery = batchQuery.ilike('company_name', `%${filters.company.value}%`);
          else if (filters.company.operator === 'equals') batchQuery = batchQuery.eq('company_name', filters.company.value);
          else if (filters.company.operator === 'starts_with') batchQuery = batchQuery.ilike('company_name', `${filters.company.value}%`);
        }
        if (filters.industryType?.length > 0) batchQuery = batchQuery.in('industry_type', filters.industryType);
        if (filters.subIndustry?.length > 0) batchQuery = batchQuery.in('sub_industry', filters.subIndustry);
        if (filters.city?.length > 0) batchQuery = batchQuery.in('city', filters.city);
        if (filters.state?.length > 0) batchQuery = batchQuery.in('state', filters.state);
        if (filters.zone?.length > 0) batchQuery = batchQuery.in('zone', filters.zone);
        if (filters.tier?.length > 0) batchQuery = batchQuery.in('tier', filters.tier);
        if (filters.designation?.length > 0 && (source === 'master' || source === 'demandcom')) batchQuery = batchQuery.in('designation', filters.designation);
        if (filters.department?.length > 0 && (source === 'master' || source === 'demandcom')) batchQuery = batchQuery.in('deppt', filters.department);
        if (filters.erpName?.length > 0 && (source === 'master' || source === 'demandcom')) batchQuery = batchQuery.in('erp_name', filters.erpName);
        if (filters.assignmentStatus?.length > 0 && source === 'demandcom') batchQuery = batchQuery.in('assignment_status', filters.assignmentStatus);
        if (filters.disposition?.length > 0 && source === 'demandcom') batchQuery = batchQuery.in('latest_disposition', filters.disposition);
        if (filters.source?.length > 0 && source === 'demandcom') batchQuery = batchQuery.in('source', filters.source);
        if (filters.projectStatus?.length > 0 && source === 'projects') batchQuery = batchQuery.in('status', filters.projectStatus);
        
        // Additional text filters
        if (filters.activityName?.value && (source === 'master' || source === 'demandcom')) {
          if (filters.activityName.operator === 'contains') batchQuery = batchQuery.ilike('activity_name', `%${filters.activityName.value}%`);
          else if (filters.activityName.operator === 'equals') batchQuery = batchQuery.eq('activity_name', filters.activityName.value);
          else if (filters.activityName.operator === 'starts_with') batchQuery = batchQuery.ilike('activity_name', `${filters.activityName.value}%`);
        }
        if (filters.mobile2?.value && (source === 'master' || source === 'demandcom')) {
          if (filters.mobile2.operator === 'contains') batchQuery = batchQuery.ilike('mobile2', `%${filters.mobile2.value}%`);
          else if (filters.mobile2.operator === 'equals') batchQuery = batchQuery.eq('mobile2', filters.mobile2.value);
          else if (filters.mobile2.operator === 'starts_with') batchQuery = batchQuery.ilike('mobile2', `${filters.mobile2.value}%`);
        }
        if (filters.linkedin?.value && (source === 'master' || source === 'demandcom')) {
          if (filters.linkedin.operator === 'contains') batchQuery = batchQuery.ilike('linkedin', `%${filters.linkedin.value}%`);
          else if (filters.linkedin.operator === 'equals') batchQuery = batchQuery.eq('linkedin', filters.linkedin.value);
          else if (filters.linkedin.operator === 'starts_with') batchQuery = batchQuery.ilike('linkedin', `${filters.linkedin.value}%`);
        }
        if (filters.location?.value && (source === 'master' || source === 'demandcom')) {
          if (filters.location.operator === 'contains') batchQuery = batchQuery.ilike('location', `%${filters.location.value}%`);
          else if (filters.location.operator === 'equals') batchQuery = batchQuery.eq('location', filters.location.value);
          else if (filters.location.operator === 'starts_with') batchQuery = batchQuery.ilike('location', `${filters.location.value}%`);
        }
        if (filters.address?.value && (source === 'master' || source === 'demandcom')) {
          if (filters.address.operator === 'contains') batchQuery = batchQuery.ilike('address', `%${filters.address.value}%`);
          else if (filters.address.operator === 'equals') batchQuery = batchQuery.eq('address', filters.address.value);
          else if (filters.address.operator === 'starts_with') batchQuery = batchQuery.ilike('address', `${filters.address.value}%`);
        }
        if (filters.pincode?.value && (source === 'master' || source === 'demandcom')) {
          if (filters.pincode.operator === 'contains') batchQuery = batchQuery.ilike('pincode', `%${filters.pincode.value}%`);
          else if (filters.pincode.operator === 'equals') batchQuery = batchQuery.eq('pincode', filters.pincode.value);
          else if (filters.pincode.operator === 'starts_with') batchQuery = batchQuery.ilike('pincode', `${filters.pincode.value}%`);
        }
        if (filters.website?.value && (source === 'master' || source === 'demandcom')) {
          if (filters.website.operator === 'contains') batchQuery = batchQuery.ilike('website', `%${filters.website.value}%`);
          else if (filters.website.operator === 'equals') batchQuery = batchQuery.eq('website', filters.website.value);
          else if (filters.website.operator === 'starts_with') batchQuery = batchQuery.ilike('website', `${filters.website.value}%`);
        }
        if (filters.salutation?.value && (source === 'master' || source === 'demandcom')) {
          if (filters.salutation.operator === 'contains') batchQuery = batchQuery.ilike('salutation', `%${filters.salutation.value}%`);
          else if (filters.salutation.operator === 'equals') batchQuery = batchQuery.eq('salutation', filters.salutation.value);
          else if (filters.salutation.operator === 'starts_with') batchQuery = batchQuery.ilike('salutation', `${filters.salutation.value}%`);
        }
        if (filters.jobLevel?.value && (source === 'master' || source === 'demandcom')) {
          if (filters.jobLevel.operator === 'contains') batchQuery = batchQuery.ilike('job_level_updated', `%${filters.jobLevel.value}%`);
          else if (filters.jobLevel.operator === 'equals') batchQuery = batchQuery.eq('job_level_updated', filters.jobLevel.value);
          else if (filters.jobLevel.operator === 'starts_with') batchQuery = batchQuery.ilike('job_level_updated', `${filters.jobLevel.value}%`);
        }
        
        if (filters.createdDate?.from) batchQuery = batchQuery.gte('created_at', filters.createdDate.from);
        if (filters.createdDate?.to) batchQuery = batchQuery.lte('created_at', filters.createdDate.to);
        if (filters.lastCallDate?.from && (source === 'master' || source === 'demandcom')) batchQuery = batchQuery.gte('last_call_date', filters.lastCallDate.from);
        if (filters.lastCallDate?.to && (source === 'master' || source === 'demandcom')) batchQuery = batchQuery.lte('last_call_date', filters.lastCallDate.to);
        if (filters.nextCallDate?.from && (source === 'master' || source === 'demandcom')) batchQuery = batchQuery.gte('next_call_date', filters.nextCallDate.from);
        if (filters.nextCallDate?.to && (source === 'master' || source === 'demandcom')) batchQuery = batchQuery.lte('next_call_date', filters.nextCallDate.to);
        if (filters.birthdayDate?.from && source === 'clients') batchQuery = batchQuery.gte('birthday_date', filters.birthdayDate.from);
        if (filters.birthdayDate?.to && source === 'clients') batchQuery = batchQuery.lte('birthday_date', filters.birthdayDate.to);
        if (filters.anniversaryDate?.from && source === 'clients') batchQuery = batchQuery.gte('anniversary_date', filters.anniversaryDate.from);
        if (filters.anniversaryDate?.to && source === 'clients') batchQuery = batchQuery.lte('anniversary_date', filters.anniversaryDate.to);
      }

      const { data: batch, error: batchError } = await batchQuery
        .order('created_at', { ascending: false })
        .range(offset, to);

      if (batchError) {
        console.error('Error fetching batch:', batchError);
        return errorResponse(`Failed to fetch batch at offset ${offset}`, 500, batchError);
      }

      if (!batch || batch.length === 0) {
        console.log('No more records to process');
        break;
      }

      // Collect unique user IDs from batch
      const userIds = new Set<string>();
      batch.forEach((record: any) => {
        if (record.assigned_to) userIds.add(record.assigned_to);
        if (record.assigned_by) userIds.add(record.assigned_by);
        if (record.created_by) userIds.add(record.created_by);
      });

      console.log(`[Batch ${Math.floor(offset / batchSize) + 1}] Collected ${userIds.size} unique user IDs`);

      // Fetch profiles for these user IDs
      const userMap = new Map<string, string>();
      if (userIds.size > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', Array.from(userIds));

        if (profileError) {
          console.error('Error fetching profiles:', profileError);
        }

        console.log(`[Batch ${Math.floor(offset / batchSize) + 1}] Found ${profiles?.length || 0} profiles`);

        profiles?.forEach((p: any) => {
          if (p.full_name) {
            userMap.set(p.id, p.full_name);
          }
        });

        console.log(`[Batch ${Math.floor(offset / batchSize) + 1}] Created user map with ${userMap.size} entries`);

        if (userIds.size > 0 && userMap.size === 0) {
          console.warn('WARNING: User IDs found but no profiles resolved!');
        }
      }

      // Convert batch to CSV rows
      for (const record of batch) {
        const transformedRecord: any = { ...(record as any) };
        
        // Replace UUIDs with actual names, with fallback for unresolved IDs
        if (transformedRecord.assigned_to) {
          const resolvedName = userMap.get(transformedRecord.assigned_to);
          transformedRecord.assigned_to = resolvedName || (transformedRecord.assigned_to.includes('-') ? '' : transformedRecord.assigned_to);
        }
        if (transformedRecord.assigned_by) {
          const resolvedName = userMap.get(transformedRecord.assigned_by);
          transformedRecord.assigned_by = resolvedName || (transformedRecord.assigned_by.includes('-') ? '' : transformedRecord.assigned_by);
        }
        if (transformedRecord.created_by) {
          const resolvedName = userMap.get(transformedRecord.created_by);
          transformedRecord.created_by = resolvedName || (transformedRecord.created_by.includes('-') ? '' : transformedRecord.created_by);
        }
        
        const row = allColumns.map(col => {
          let value = transformedRecord[col];

          if (value === null || value === undefined) {
            return '';
          }

          // Handle arrays and objects
          if (Array.isArray(value)) {
            value = value.join('; ');
          } else if (typeof value === 'object') {
            value = JSON.stringify(value);
          }

          let stringValue = String(value);

          if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
            stringValue = `"${stringValue.replace(/"/g, '""')}"`;
          }

          return stringValue;
        }).join(',');

        csvContent += row + '\n';
      }

      processedRecords += batch.length;
      console.log(`Processed ${processedRecords} of ${totalRecords} records`);
    }

    console.log(`Export completed. Total records: ${processedRecords}`);

    return new Response(csvContent, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv;charset=utf-8;',
        'Content-Disposition': `attachment; filename="${source}-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });

  } catch (error) {
    console.error('Export error:', error);
    return errorResponse(
      'Failed to export data',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
});
