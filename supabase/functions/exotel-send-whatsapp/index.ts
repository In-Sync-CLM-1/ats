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
    const EXOTEL_WHATSAPP_FROM = Deno.env.get('EXOTEL_WHATSAPP_FROM');
    const EXOTEL_SUBDOMAIN = Deno.env.get('EXOTEL_SUBDOMAIN') || 'api.in.exotel.com';

    if (!EXOTEL_API_KEY || !EXOTEL_API_TOKEN || !EXOTEL_SID) {
      console.error('Missing Exotel credentials');
      return new Response(
        JSON.stringify({ error: 'Exotel credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!EXOTEL_WHATSAPP_FROM) {
      console.error('Missing Exotel WhatsApp From number');
      return new Response(
        JSON.stringify({ error: 'Exotel WhatsApp sender number not configured. Please add EXOTEL_WHATSAPP_FROM secret.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log configuration (without exposing sensitive values)
    console.log('=== Exotel WhatsApp Configuration ===');
    console.log(`Subdomain: ${EXOTEL_SUBDOMAIN}`);
    console.log(`SID: ${EXOTEL_SID}`);
    console.log(`WhatsApp From: ${EXOTEL_WHATSAPP_FROM}`);
    console.log('=====================================');

    // Get request body
    const { 
      to_number, 
      message,
      template_name,
      template_params,
      candidate_id,
    } = await req.json();

    if (!to_number) {
      return new Response(
        JSON.stringify({ error: 'to_number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!message && !template_name) {
      return new Response(
        JSON.stringify({ error: 'Either message or template_name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user info for logging
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    let userId: string | null = null;

    if (authHeader) {
      const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      
      const { data: { user } } = await supabaseClient.auth.getUser();
      userId = user?.id || null;
    }

    console.log(`Sending WhatsApp message to ${to_number}`);

    // Create authorization header (Basic Auth)
    const authString = btoa(`${EXOTEL_API_KEY}:${EXOTEL_API_TOKEN}`);
    
    // Format phone number for WhatsApp (ensure it has country code)
    let formattedToNumber = to_number.replace(/\s+/g, '').replace(/^0+/, '');
    if (!formattedToNumber.startsWith('+')) {
      // Assume India if no country code
      if (!formattedToNumber.startsWith('91')) {
        formattedToNumber = '91' + formattedToNumber;
      }
      formattedToNumber = '+' + formattedToNumber;
    }

    let formattedFromNumber = EXOTEL_WHATSAPP_FROM.replace(/\s+/g, '');
    if (!formattedFromNumber.startsWith('+')) {
      formattedFromNumber = '+' + formattedFromNumber;
    }

    // Exotel WhatsApp API endpoint
    const exotelUrl = `https://${EXOTEL_SUBDOMAIN}/v2/accounts/${EXOTEL_SID}/messages`;
    
    console.log(`Using Exotel WhatsApp endpoint: ${exotelUrl}`);

    // Prepare message payload
    const messagePayload: Record<string, unknown> = {
      from: formattedFromNumber,
      to: formattedToNumber,
      channel: 'whatsapp',
    };

    if (template_name) {
      // Template message
      messagePayload.content = {
        type: 'template',
        template: {
          name: template_name,
          ...(template_params && { parameters: template_params }),
        },
      };
    } else {
      // Free-form text message (requires 24-hour window)
      messagePayload.content = {
        type: 'text',
        text: message,
      };
    }

    console.log('Sending WhatsApp message with payload:', JSON.stringify(messagePayload));

    // Make the API call to Exotel
    const response = await fetch(exotelUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload),
    });

    const responseData = await response.json();

    console.log('Exotel WhatsApp API response:', response.status, responseData);

    if (!response.ok) {
      console.error('Exotel WhatsApp API error:', responseData);
      
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ 
            error: 'Exotel authentication failed',
            message: 'Invalid credentials or incorrect cluster subdomain',
            details: responseData,
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send WhatsApp message',
          details: responseData 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the message in call_logs table (reusing for WhatsApp)
    if (userId) {
      try {
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const messageSid = responseData?.sid || responseData?.message_sid || `wa_${Date.now()}`;
        
        const { error: logError } = await supabase
          .from('call_logs')
          .insert({
            call_sid: messageSid,
            candidate_id: candidate_id || null,
            initiated_by: userId,
            from_number: formattedFromNumber,
            to_number: formattedToNumber,
            status: 'sent',
            direction: 'outbound-api',
            call_method: 'whatsapp',
            notes: message || `Template: ${template_name}`,
            exotel_response: responseData,
            start_time: new Date().toISOString(),
          });

        if (logError) {
          console.error('Error logging WhatsApp message:', logError);
        } else {
          console.log(`WhatsApp message logged successfully for candidate ${candidate_id}`);
        }

        // Also write the conversation thread (whatsapp_messages powers the
        // Messages tab on the candidate profile)
        let orgId: string | null = null;
        if (candidate_id) {
          const { data: cand } = await supabase
            .from('candidates')
            .select('org_id')
            .eq('id', candidate_id)
            .maybeSingle();
          orgId = cand?.org_id ?? null;
        }
        const { error: threadError } = await supabase
          .from('whatsapp_messages')
          .insert({
            org_id: orgId,
            candidate_id: candidate_id || null,
            phone: formattedToNumber.replace(/\D/g, '').slice(-10),
            direction: 'outbound',
            body: message || `Template: ${template_name}`,
            template_name: template_name || null,
            exotel_sid: messageSid,
            status: 'sent',
            sent_by: userId,
          });
        if (threadError) console.error('Error writing whatsapp thread:', threadError);
      } catch (logError) {
        console.error('Error logging WhatsApp message:', logError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: responseData 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in exotel-send-whatsapp function:', error);
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
