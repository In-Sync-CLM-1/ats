import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get Exotel credentials from environment
    const EXOTEL_API_KEY = Deno.env.get('EXOTEL_API_KEY');
    const EXOTEL_API_TOKEN = Deno.env.get('EXOTEL_API_TOKEN');
    const EXOTEL_SID = Deno.env.get('EXOTEL_SID');
    const EXOTEL_CALLER_ID = Deno.env.get('EXOTEL_CALLER_ID');
    const EXOTEL_SUBDOMAIN = Deno.env.get('EXOTEL_SUBDOMAIN') || 'api.in.exotel.com';

    if (!EXOTEL_API_KEY || !EXOTEL_API_TOKEN || !EXOTEL_SID || !EXOTEL_CALLER_ID) {
      console.error('Missing Exotel credentials');
      return new Response(
        JSON.stringify({ error: 'Exotel credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log credential configuration (without exposing sensitive values)
    console.log('=== Exotel Configuration ===');
    console.log(`Subdomain: ${EXOTEL_SUBDOMAIN}`);
    console.log(`SID: ${EXOTEL_SID}`);
    console.log(`API Key configured: ${EXOTEL_API_KEY?.substring(0, 4)}...`);
    console.log(`API Token configured: ${EXOTEL_API_TOKEN ? 'Yes' : 'No'}`);
    console.log(`Caller ID: ${EXOTEL_CALLER_ID}`);
    console.log('==========================');

    // Get request body
    const { 
      to_number, 
      from_number, 
      candidate_id, 
      custom_field,
      edited_contact_info = {},
      disposition = null,
      subdisposition = null,
      notes = null,
      next_call_date = null
    } = await req.json();

    if (!to_number) {
      return new Response(
        JSON.stringify({ error: 'to_number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Supabase client for user profile access
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    let agentPhone = from_number;
    let userId: string | null = null;

    // If from_number not provided, fetch from user profile
    if (!agentPhone && authHeader) {
      const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      
      const { data: { user } } = await supabaseClient.auth.getUser();
      userId = user?.id || null;
      
      if (userId) {
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('phone')
          .eq('id', userId)
          .single();
        
        if (profile?.phone) {
          agentPhone = profile.phone;
          console.log(`Using agent phone from profile: ${agentPhone}`);
        }
      }
    }

    console.log(`Initiating call to ${to_number} from ${agentPhone || EXOTEL_CALLER_ID}`);

    // Create authorization header (Basic Auth)
    const authString = btoa(`${EXOTEL_API_KEY}:${EXOTEL_API_TOKEN}`);
    
    // Use configured subdomain
    const subdomain = EXOTEL_SUBDOMAIN;
    
    // Exotel API endpoint
    const exotelUrl = `https://${subdomain}/v1/Accounts/${EXOTEL_SID}/Calls/connect.json`;
    
    console.log(`Using Exotel endpoint: ${exotelUrl}`);

    // Prepare call parameters
    const callParams = new URLSearchParams({
      From: agentPhone || EXOTEL_CALLER_ID,
      To: to_number,
      CallerId: EXOTEL_CALLER_ID,
      Record: 'true',
      ...(custom_field && { CustomField: custom_field }),
    });

    console.log('Making request to Exotel API:', exotelUrl);

    // Add StatusCallback URL for receiving call status updates
    const FUNCTION_URL = Deno.env.get('SUPABASE_URL')!;
    const webhookUrl = `${FUNCTION_URL}/functions/v1/exotel-webhook`;
    
    console.log(`Setting StatusCallback URL: ${webhookUrl}`);

    // Make the API call to Exotel
    const response = await fetch(exotelUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: callParams.toString() + `&StatusCallback=${encodeURIComponent(webhookUrl)}&StatusCallbackContentType=application/json`,
    });

    const responseData = await response.json();

    console.log('Exotel API response:', response.status, responseData);

    if (!response.ok) {
      console.error('Exotel API error:', responseData);
      
      // Provide detailed error message for 401 Unauthorized
      if (response.status === 401) {
        const errorMessage = [
          'Exotel Authentication Failed (401 Unauthorized)',
          '',
          'Possible causes:',
          `1. Incorrect subdomain: Currently using "${subdomain}"`,
          '   → Check your Exotel Dashboard → API Settings for the correct subdomain',
          '   → Singapore cluster: api.exotel.com',
          '   → Mumbai cluster: api.in.exotel.com',
          '',
          '2. Invalid API credentials:',
          '   → Verify API Key and API Token in Exotel Dashboard',
          '   → Ensure credentials haven\'t been regenerated',
          '',
          `3. Incorrect Account SID: ${EXOTEL_SID}`,
          '   → Verify this matches your Exotel account',
        ].join('\n');
        
        console.error(errorMessage);
        
        return new Response(
          JSON.stringify({ 
            error: 'Exotel authentication failed',
            message: 'Invalid credentials or incorrect cluster subdomain',
            details: responseData,
            subdomain: subdomain,
            sid: EXOTEL_SID,
            troubleshooting: {
              step1: 'Go to Exotel Dashboard → API Settings',
              step2: 'Verify your subdomain (api.exotel.com or api.in.exotel.com)',
              step3: 'Update EXOTEL_SUBDOMAIN secret if needed',
              step4: 'Verify API Key and API Token are correct',
              step5: 'Ensure Account SID matches your account'
            }
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to initiate call',
          details: responseData 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the call in our database
    if (userId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const callSid = responseData?.Call?.Sid || responseData?.Sid;
        
        if (callSid) {
          const { error: logError } = await supabase
            .from('call_logs')
            .insert({
              call_sid: callSid,
              candidate_id: candidate_id || null,
              initiated_by: userId,
              from_number: agentPhone || EXOTEL_CALLER_ID,
              to_number: to_number,
              status: 'initiated',
              direction: 'outbound-api',
              call_method: 'phone',
              edited_contact_info: edited_contact_info,
              disposition: disposition,
              subdisposition: subdisposition,
              notes: notes,
              exotel_response: responseData,
              start_time: new Date().toISOString(),
            });

          if (logError) {
            console.error('Error logging call:', logError);
          } else {
            console.log(`Call logged successfully for candidate ${candidate_id}, Call SID: ${callSid}`);
          }
          
          // Update candidate with next call date if provided
          if (next_call_date && candidate_id) {
            const { error: updateError } = await supabase
              .from('candidates')
              .update({ next_call_date: next_call_date })
              .eq('id', candidate_id);
            
            if (updateError) {
              console.error('Error updating next call date:', updateError);
            } else {
              console.log(`Next call date updated for candidate ${candidate_id}`);
            }
          }
        }
      } catch (logError) {
        console.error('Error logging call:', logError);
        // Don't fail the request if logging fails
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        call: responseData 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in exotel-make-call function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
