import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_FROM_NUMBER = "+911169323462";
const BOLNA_API_BASE = "https://api.bolna.ai";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.startsWith("+")) return phone;
  return `+${digits}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { candidate_id } = await req.json();
    if (!candidate_id) throw new Error("candidate_id is required");

    const BOLNA_API_KEY = Deno.env.get("BOLNA_API_KEY");
    if (!BOLNA_API_KEY) throw new Error("BOLNA_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get candidate details
    const { data: candidate, error: cErr } = await supabase
      .from("candidates")
      .select("id, org_id, first_name, last_name, mobile_number, position_applied_for, key_skills, total_experience_years, current_status, interview_stage")
      .eq("id", candidate_id)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!candidate) throw new Error("Candidate not found");
    if (!candidate.mobile_number) throw new Error("Candidate has no mobile number");

    // Get org Bolna config
    const { data: creds } = await supabase
      .from("org_credentials")
      .select("bolna_agent_id, bolna_caller_id")
      .eq("org_id", candidate.org_id)
      .maybeSingle();

    const agentId = creds?.bolna_agent_id;
    const fromNumber = creds?.bolna_caller_id || DEFAULT_FROM_NUMBER;
    if (!agentId) throw new Error("Bolna agent not configured for this organisation. Set bolna_agent_id in org_credentials.");

    const toNumber = normalizePhone(candidate.mobile_number);

    // Create call_log row first to get the ID
    const { data: callLog, error: clErr } = await supabase
      .from("call_logs")
      .insert({
        candidate_id,
        org_id: candidate.org_id,
        call_method: "bolna",
        status: "initiated",
        notes: `AI screening call initiated for ${candidate.position_applied_for || "open position"}`,
      })
      .select("id")
      .single();
    if (clErr) throw clErr;

    // Trigger Bolna call
    const bolnaResp = await fetch(`${BOLNA_API_BASE}/call`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${BOLNA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: agentId,
        recipient_phone_number: toNumber,
        from_phone_number: fromNumber,
        user_data: {
          candidate_name: `${candidate.first_name} ${candidate.last_name}`.trim(),
          position: candidate.position_applied_for || "",
          experience_years: candidate.total_experience_years || "",
          key_skills: candidate.key_skills || "",
          call_log_id: callLog.id,
        },
      }),
    });

    if (!bolnaResp.ok) {
      const errText = await bolnaResp.text();
      await supabase.from("call_logs").update({ status: "failed", notes: `Bolna error: ${errText}` }).eq("id", callLog.id);
      throw new Error(`Bolna API error: ${bolnaResp.status} ${errText}`);
    }

    const bolnaData = await bolnaResp.json();
    const executionId = bolnaData.execution_id || bolnaData.call_id || bolnaData.id;

    await supabase
      .from("call_logs")
      .update({ bolna_execution_id: executionId, status: "dialing" })
      .eq("id", callLog.id);

    // Update candidate status
    await supabase
      .from("candidates")
      .update({ current_status: "AI Screening In Progress", last_call_date: new Date().toISOString().split("T")[0] })
      .eq("id", candidate_id);

    return new Response(JSON.stringify({
      success: true,
      call_log_id: callLog.id,
      execution_id: executionId,
      to: toNumber,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ai-screen-candidate error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
