import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { contact, otp_code, type } = await req.json();
    if (!contact || !otp_code || !type) throw new Error("Missing contact, otp_code, or type");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: record, error } = await supabase
      .from("onboarding_otp_verifications")
      .select("*")
      .eq("contact", contact)
      .eq("type", type)
      .eq("verified", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !record) {
      return new Response(
        JSON.stringify({ error: "OTP expired or not found. Please request a new one." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (record.otp_code !== otp_code) {
      return new Response(
        JSON.stringify({ error: "Invalid OTP code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await supabase
      .from("onboarding_otp_verifications")
      .update({ verified: true })
      .eq("id", record.id);

    return new Response(JSON.stringify({ success: true, verified: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("verify-onboarding-otp error:", err);
    return new Response(JSON.stringify({ error: err.message || "Verification failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
