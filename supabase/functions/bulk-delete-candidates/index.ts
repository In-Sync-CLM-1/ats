import { createAuthenticatedClient } from '../_shared/supabase-client.ts';
import { createSupabaseClient } from '../_shared/supabase-client.ts';
import { verifyAuth } from '../_shared/auth-helpers.ts';
import { corsHeaders } from '../_shared/cors-headers.ts';
import { successResponse, errorResponse, unauthorizedResponse } from '../_shared/response-helpers.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    const { authenticated, user } = await verifyAuth(authHeader);

    if (!authenticated || !user) {
      return unauthorizedResponse('Authentication required');
    }

    // Get user roles
    const supabase = createAuthenticatedClient(authHeader!);
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roles = rolesData?.map((r) => r.role) || [];
    
    // Check authorization: special user email OR admin/manager role
    const isSpecialUser = user.email === 'jatinder.mahajan@redefine.in';
    const isAuthorized = roles.some((role) =>
      ['platform_admin', 'super_admin', 'admin_administration', 'admin_tech', 'admin', 'manager'].includes(role)
    );

    if (!isSpecialUser && !isAuthorized) {
      console.log(`Unauthorized delete attempt by user ${user.email}`);
      return unauthorizedResponse('Insufficient permissions for bulk delete');
    }

    // Parse request body
    const { recordIds } = await req.json();

    if (!recordIds || !Array.isArray(recordIds) || recordIds.length === 0) {
      return errorResponse('Invalid request: recordIds array is required', 400);
    }

    console.log(`User ${user.email} (${user.id}) attempting to delete ${recordIds.length} candidates`);

    // Use service role for cascade deletion
    const adminSupabase = createSupabaseClient(authHeader);

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ recordId: string; error: string }> = [];

    // Delete each record with cascade handling
    for (const recordId of recordIds) {
      try {
        // Delete related data first (tables without ON DELETE CASCADE)
        await adminSupabase.from('webhook_logs').delete().eq('candidate_id', recordId);
        await adminSupabase.from('public_job_applications').delete().eq('candidate_id', recordId);
        
        // These tables have ON DELETE CASCADE, but explicitly delete for safety
        await adminSupabase.from('call_logs').delete().eq('candidate_id', recordId);
        await adminSupabase.from('candidates_pipeline').delete().eq('candidate_id', recordId);
        await adminSupabase.from('candidate_resumes').delete().eq('candidate_id', recordId);
        await adminSupabase.from('mandate_candidates').delete().eq('candidate_id', recordId);

        // Delete main candidate record
        const { error } = await adminSupabase.from('candidates').delete().eq('id', recordId);

        if (error) {
          throw error;
        }

        successCount++;
        console.log(`Successfully deleted candidate record ${recordId}`);
      } catch (error) {
        errorCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ recordId, error: errorMessage });
        console.error(`Failed to delete candidate ${recordId}:`, errorMessage);
      }
    }

    return successResponse({
      message: `Bulk delete completed`,
      successCount,
      errorCount,
      totalRequested: recordIds.length,
      errors: errorCount > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('Bulk delete error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to delete candidates',
      500
    );
  }
});
