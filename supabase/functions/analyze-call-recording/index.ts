import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GROQ_API_BASE = "https://api.groq.com/openai/v1";
const CLAUDE_MODEL = "claude-haiku-4-5";

const ANALYSIS_SYSTEM = `You are a recruitment call analysis AI. Given a call transcript between a recruiter or AI screening agent and a candidate, extract structured intelligence.

Return ONLY valid JSON — no prose, no markdown fences:
{
  "interest_level": "high|medium|low|not_interested",
  "current_ctc_lakhs": <number or null>,
  "expected_ctc_lakhs": <number or null>,
  "notice_period_days": <integer or null>,
  "availability": "<date string or 'Immediate' or null>",
  "key_concerns": ["<concern1>", "<concern2>"],
  "next_step": "<e.g. 'Schedule technical interview', 'Send offer details', 'No further action'>",
  "quality_score": <0-100 integer — 100 = candidate is ideal and highly engaged>,
  "summary": "<2-3 sentence human-readable summary of the conversation>"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { call_log_id } = await req.json();
    if (!call_log_id) throw new Error("call_log_id is required");

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: callLog, error: clErr } = await supabase
      .from("call_logs")
      .select("id, candidate_id, org_id, recording_url, transcript, call_method, notes")
      .eq("id", call_log_id)
      .maybeSingle();
    if (clErr) throw clErr;
    if (!callLog) throw new Error("Call log not found");
    if (!callLog.recording_url && !callLog.transcript) throw new Error("No recording URL or transcript available");

    let transcript = callLog.transcript;

    if (!transcript && callLog.recording_url) {
      // Download the recording
      const audioResp = await fetch(callLog.recording_url);
      if (!audioResp.ok) throw new Error(`Failed to download recording: ${audioResp.status}`);
      const audioBlob = await audioResp.blob();

      // Transcribe via Groq Whisper
      const form = new FormData();
      form.append("file", new File([audioBlob], "recording.mp3", { type: "audio/mpeg" }));
      form.append("model", "whisper-large-v3");
      form.append("response_format", "json");
      form.append("language", "en");

      const transcribeResp = await fetch(`${GROQ_API_BASE}/audio/transcriptions`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${GROQ_API_KEY}` },
        body: form,
      });
      if (!transcribeResp.ok) throw new Error(`Groq Whisper error: ${transcribeResp.status} ${await transcribeResp.text()}`);
      const transcribeData = await transcribeResp.json();
      transcript = transcribeData.text;

      await supabase.from("call_logs").update({ transcript }).eq("id", call_log_id);
    }

    // Fetch candidate name for context
    const { data: candidate } = await supabase
      .from("candidates")
      .select("first_name, last_name, position_applied_for")
      .eq("id", callLog.candidate_id)
      .maybeSingle();

    const contextNote = candidate
      ? `Candidate: ${candidate.first_name} ${candidate.last_name}, Position: ${candidate.position_applied_for || "unspecified"}`
      : "";

    const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 768,
        system: ANALYSIS_SYSTEM,
        messages: [{
          role: "user",
          content: `${contextNote}\n\nTRANSCRIPT:\n${transcript}`,
        }],
      }),
    });

    if (!claudeResp.ok) throw new Error(`Claude API error: ${claudeResp.status} ${await claudeResp.text()}`);
    const claudeData = await claudeResp.json();
    const rawText = claudeData.content?.[0]?.text || "";

    let analysis: any;
    try {
      analysis = JSON.parse(rawText.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());
    } catch {
      throw new Error(`Failed to parse AI analysis: ${rawText}`);
    }

    await supabase.from("call_logs").update({
      analysis_json: analysis,
      analysis_quality_score: analysis.quality_score,
      disposition: dispositionFromInterest(analysis.interest_level),
    }).eq("id", call_log_id);

    // Propagate extracted CTC/notice to candidate if available
    if (callLog.candidate_id) {
      const candidateUpdates: Record<string, any> = {};
      if (analysis.expected_ctc_lakhs != null) candidateUpdates.expected_ctc_lakhs = analysis.expected_ctc_lakhs;
      if (Object.keys(candidateUpdates).length > 0) {
        await supabase.from("candidates").update(candidateUpdates).eq("id", callLog.candidate_id);
      }
    }

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("analyze-call-recording error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function dispositionFromInterest(level: string): string {
  switch (level) {
    case "high": return "Interested";
    case "medium": return "Callback";
    case "low": return "Warm Follow-up";
    case "not_interested": return "Not Interested";
    default: return "Pending Review";
  }
}
