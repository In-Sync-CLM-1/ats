import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { contact, type } = await req.json();
    if (!contact || !type) throw new Error("Missing contact or type");
    if (type !== "email" && type !== "phone") throw new Error("type must be 'email' or 'phone'");

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    await supabase.from("onboarding_otp_verifications").insert({
      contact,
      otp_code: otp,
      type,
      expires_at: expiresAt,
    });

    if (type === "email") {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");
      const resend = new Resend(resendApiKey);
      const { error } = await resend.emails.send({
        from: "ATS Onboarding <noreply@in-sync.co.in>",
        to: [contact],
        subject: "Your Onboarding Verification Code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #1e3a5f; margin-bottom: 16px;">Email Verification</h2>
            <p style="color: #555; margin-bottom: 24px;">Use this code to verify your email address for the onboarding form:</p>
            <div style="background: #f0f4f8; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1e3a5f;">${otp}</span>
            </div>
            <p style="color: #888; font-size: 13px;">This code expires in 10 minutes. Do not share it with anyone.</p>
          </div>
        `,
      });
      if (error) throw new Error(`Failed to send verification email: ${error.message}`);
    } else {
      // Phone OTP via Exotel WhatsApp
      const exotelSid = Deno.env.get("EXOTEL_SID") || Deno.env.get("EXOTEL_ACCOUNT_SID");
      const exotelApiKey = Deno.env.get("EXOTEL_API_KEY");
      const exotelApiToken = Deno.env.get("EXOTEL_API_TOKEN");

      if (!exotelSid || !exotelApiKey || !exotelApiToken) {
        throw new Error("Exotel credentials not configured for WhatsApp OTP");
      }

      const { data: creds } = await supabase
        .from("org_credentials")
        .select("exotel_sender_number, exotel_waba_id")
        .limit(1)
        .maybeSingle();

      const sourceNumber = creds?.exotel_sender_number || "918178798930";
      let phone = contact.replace(/[^\d+]/g, "");
      if (phone.startsWith("+")) phone = phone.slice(1);
      if (phone.length === 10) phone = "91" + phone;

      const payload = {
        whatsapp: {
          messages: [{
            from: sourceNumber,
            to: phone,
            content: {
              type: "template",
              template: {
                name: "otp",
                language: { code: "en" },
                components: [{ type: "body", parameters: [{ type: "text", text: otp }] }],
              },
            },
          }],
        },
      };

      const resp = await fetch(`https://api.exotel.com/v2/accounts/${exotelSid}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${btoa(`${exotelApiKey}:${exotelApiToken}`)}`,
        },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error(`Exotel WhatsApp OTP failed: ${resp.status}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("send-onboarding-otp error:", err);
    return new Response(JSON.stringify({ error: err.message || "Failed to send OTP" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
