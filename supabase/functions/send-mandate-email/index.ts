import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MandateEmailRequest {
  mandate_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { mandate_id }: MandateEmailRequest = await req.json();

    console.log("Fetching mandate:", mandate_id);

    // Fetch mandate details
    const { data: mandate, error: mandateError } = await supabaseClient
      .from("mandates")
      .select(`
        *,
        clients (
          company_name,
          contact_name
        )
      `)
      .eq("id", mandate_id)
      .single();

    if (mandateError) {
      console.error("Error fetching mandate:", mandateError);
      throw new Error(`Failed to fetch mandate: ${mandateError.message}`);
    }

    console.log("Mandate fetched successfully:", mandate);

    // Fetch team members and their profiles
    const { data: teamMembers, error: teamError } = await supabaseClient
      .from("mandate_team_members")
      .select(`
        user_id,
        role_in_mandate,
        profiles (
          email,
          full_name
        )
      `)
      .eq("mandate_id", mandate_id);

    if (teamError) {
      console.error("Error fetching team members:", teamError);
      throw new Error(`Failed to fetch team members: ${teamError.message}`);
    }

    console.log("Team members fetched:", teamMembers);

    // Check which users have already been notified
    const { data: notifiedUsers, error: notificationError } = await supabaseClient
      .from("mandate_team_notifications")
      .select("user_id")
      .eq("mandate_id", mandate_id)
      .eq("notification_type", "mandate_assignment");

    if (notificationError) {
      console.error("Error fetching notifications:", notificationError);
    }

    const notifiedUserIds = new Set(notifiedUsers?.map(n => n.user_id) || []);
    console.log("Already notified user IDs:", Array.from(notifiedUserIds));

    // Filter out already notified users
    const newTeamMembers = teamMembers?.filter(
      member => !notifiedUserIds.has(member.user_id)
    ) || [];

    console.log(`Sending emails to ${newTeamMembers.length} new team members`);

    let emailsSent = 0;
    let emailsFailed = 0;

    // Send emails to new team members
    for (const member of newTeamMembers) {
      const profile = member.profiles as any;
      
      if (!profile?.email) {
        console.log(`Skipping member ${member.user_id} - no email found`);
        continue;
      }

      // Format mandate locations
      let locationsText = 'Not specified';
      if (mandate.locations && Array.isArray(mandate.locations)) {
        locationsText = mandate.locations
          .map((loc: any) => `${loc.city || ''}, ${loc.state || ''}`.trim())
          .filter((loc: string) => loc.length > 2)
          .join('; ');
      } else if (mandate.job_location) {
        locationsText = mandate.job_location;
      }

      const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background: #f9fafb; }
              .mandate-details { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; }
              .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
              .detail-label { font-weight: bold; color: #6b7280; }
              .detail-value { color: #111827; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>New Mandate Assignment</h1>
              </div>
              <div class="content">
                <h2>Hello ${profile.full_name || 'Team Member'},</h2>
                <p>You have been assigned to a new mandate. Here are the details:</p>
                
                <div class="mandate-details">
                  <div class="detail-row">
                    <span class="detail-label">Mandate ID:</span>
                    <span class="detail-value">${mandate.mandate_id || 'N/A'}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Job Title:</span>
                    <span class="detail-value">${mandate.job_title}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Client:</span>
                    <span class="detail-value">${mandate.clients?.company_name || 'N/A'}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Your Role:</span>
                    <span class="detail-value">${member.role_in_mandate}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Location:</span>
                    <span class="detail-value">${locationsText}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value">${mandate.mandate_status}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Priority:</span>
                    <span class="detail-value">${mandate.priority_level}</span>
                  </div>
                  ${mandate.target_closure_date ? `
                  <div class="detail-row">
                    <span class="detail-label">Target Closure:</span>
                    <span class="detail-value">${new Date(mandate.target_closure_date).toLocaleDateString()}</span>
                  </div>
                  ` : ''}
                </div>
                
                <p>Please log in to the system to view more details and start working on this mandate.</p>
              </div>
              <div class="footer">
                <p>This is an automated email. Please do not reply directly to this message.</p>
              </div>
            </div>
          </body>
        </html>
      `;

      try {
        console.log(`Sending email to: ${profile.email}`);
        
        const emailResponse = await resend.emails.send({
          from: "Mandates <noreply@in-sync.co.in>",
          to: [profile.email],
          subject: `New Mandate Assignment - ${mandate.job_title}`,
          html: emailHtml,
        });

        console.log("Email sent successfully:", emailResponse);

        // Record the notification
        const { error: insertError } = await supabaseClient
          .from("mandate_team_notifications")
          .insert({
            mandate_id: mandate_id,
            user_id: member.user_id,
            notification_type: "mandate_assignment",
          });

        if (insertError) {
          console.error("Error recording notification:", insertError);
        }

        emailsSent++;
      } catch (emailError: any) {
        console.error(`Failed to send email to ${profile.email}:`, emailError);
        emailsFailed++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        emails_sent: emailsSent,
        emails_failed: emailsFailed,
        already_notified: notifiedUserIds.size,
        total_team_members: teamMembers?.length || 0,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-mandate-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
