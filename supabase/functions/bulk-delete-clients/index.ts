import { corsHeaders, handleCorsPreflightRequest } from '../_shared/cors-headers.ts';
import { createSupabaseClient } from '../_shared/supabase-client.ts';
import { verifyAuth } from '../_shared/auth-helpers.ts';
import { errorResponse, successResponse } from '../_shared/response-helpers.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest();
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const { authenticated, user, error: authError } = await verifyAuth(authHeader);

    if (!authenticated || !user) {
      console.error('Authentication failed:', authError);
      return errorResponse('Unauthorized', 401);
    }

    console.log('Authenticated user:', user.id);

    // Check if user has permission to delete clients
    const supabase = createSupabaseClient(authHeader);
    const { data: rolesData, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
      return errorResponse('Failed to verify permissions', 500);
    }

    const roles = rolesData?.map(r => r.role) || [];
    const canDelete = roles.some(role => 
      ['platform_admin', 'super_admin', 'admin', 'manager'].includes(role)
    );

    if (!canDelete) {
      console.error('User does not have permission to delete clients');
      return errorResponse('Insufficient permissions to delete clients', 403);
    }

    const { recordIds } = await req.json();

    if (!recordIds || !Array.isArray(recordIds) || recordIds.length === 0) {
      return errorResponse('Invalid request: recordIds array is required', 400);
    }

    console.log(`Processing bulk delete for ${recordIds.length} clients`);

    // Use service role client for deletion
    const serviceSupabase = createSupabaseClient();
    
    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const clientId of recordIds) {
      try {
        const { error: deleteError } = await serviceSupabase
          .from('clients')
          .delete()
          .eq('id', clientId);

        if (deleteError) {
          console.error(`Failed to delete client ${clientId}:`, deleteError);
          errorCount++;
          errors.push({ id: clientId, error: deleteError.message });
        } else {
          successCount++;
          console.log(`Successfully deleted client: ${clientId}`);
        }
      } catch (error) {
        console.error(`Exception deleting client ${clientId}:`, error);
        errorCount++;
        errors.push({ 
          id: clientId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    console.log(`Bulk delete completed. Success: ${successCount}, Errors: ${errorCount}`);

    return successResponse({
      message: 'Bulk delete completed',
      successCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Bulk delete error:', error);
    return errorResponse(
      'Internal server error',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
});
