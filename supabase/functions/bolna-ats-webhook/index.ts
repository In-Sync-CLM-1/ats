import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Bolna webhook — no Supabase JWT (verify_jwt = false in config.toml)
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Bolna webhook shape:
    // { execution_id, telephony_data: { status, duration, recording_url }, context_details: { recipient_data: { call_log_id } }, conversation_summary }
    const executionId = body.execution_id;
    const telephony = body.telephony_data || {};
    const recipientData = body.context_details?.recipient_data || {};
    const callLogId = recipientData.call_log_id;

    let callLog: any = null;

    if (callLogId) {
      const { data } = await supabase.from("call_logs").select("id, candidate_id").eq("id", callLogId).maybeSingle();
      callLog = data;
    }

    if (!callLog && executionId) {
      const { data } = await supabase.from("call_logs").select("id, candidate_id").eq("bolna_execution_id", executionId).maybeSingle();
      callLog = data;
    }

    if (!callLog) {
      console.warn("bolna-ats-webhook: no matching call_log for", { callLogId, executionId });
      return new Response(JSON.stringify({ received: true, matched: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawStatus = (telephony.status || body.status || "").toLowerCase();
    let status = "completed";
    if (rawStatus.includes("fail") || rawStatus.includes("error")) status = "failed";
    else if (rawStatus.includes("no_answer") || rawStatus.includes("no-answer")) status = "no_answer";
    else if (rawStatus.includes("busy")) status = "busy";

    const duration = telephony.duration || telephony.call_duration || 0;
    const recordingUrl = telephony.recording_url || telephony.recordingUrl || null;
    const summary = body.conversation_summary || body.summary || null;

    // Extract disposition hint from summary
    let disposition: string | null = null;
    if (summary) {
      const lc = summary.toLowerCase();
      if (lc.includes("not interested") || lc.includes("declined")) disposition = "Not Interested";
      else if (lc.includes("interested") || lc.includes("available")) disposition = "Interested";
      else if (lc.includes("call back") || lc.includes("callback")) disposition = "Callback";
      else if (lc.includes("busy") || lc.includes("not available")) disposition = "Busy / Not Available";
    }

    const updates: Record<string, any> = {
      status,
      conversation_duration: duration,
      disposition,
    };
    if (recordingUrl) updates.recording_url = recordingUrl;
    if (summary) updates.notes = summary;

    await supabase.from("call_logs").update(updates).eq("id", callLog.id);

    // Update candidate latest_disposition if we have one
    if (disposition && callLog.candidate_id) {
      await supabase.from("candidates").update({ latest_disposition: disposition, last_call_date: new Date().toISOString().split("T")[0] }).eq("id", callLog.candidate_id);
    }

    return new Response(JSON.stringify({ received: true, matched: true, call_log_id: callLog.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("bolna-ats-webhook error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
