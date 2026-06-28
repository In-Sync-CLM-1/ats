import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "claude-haiku-4-5";

const SYSTEM_PROMPT = `You are a recruitment ATS scoring AI. Score candidate fit quality 0–100, weighting interview stage most heavily, then call engagement, then profile completeness, then application quality.

Scoring guidance:
- Interview Stage is the primary signal. Hired ≥ 90, Offer 75–89, Interviewing 50–74, Screened 25–49, Sourced 10–24, None < 10.
- Call Engagement: recent connected calls and positive dispositions (Interested, Callback) raise the score; No Answer/Not Interested/Switch Off lower it.
- Profile Completeness: resume uploaded, experience years stated, key skills listed, CTC range filled — each adds points.
- Application Quality: fresh inbound / self-applied ranks higher than cold sourcing.

Categories: hire (85–100), strong (65–84), promising (45–64), weak (25–44), unqualified (0–24).

The four breakdown values MUST sum exactly to the total score. Use these caps:
  Interview Stage: 0–45, Call Engagement: 0–25, Profile Completeness: 0–20, Application Quality: 0–10.

Return ONLY valid JSON, no prose, no markdown fences:
{
  "score": <0-100 integer>,
  "category": "hire|strong|promising|weak|unqualified",
  "breakdown": { "Interview Stage": <int>, "Call Engagement": <int>, "Profile Completeness": <int>, "Application Quality": <int> },
  "reasoning": "<one or two sentences citing the strongest signals for this candidate>"
}`;

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { candidate_id, force } = await req.json();
    if (!candidate_id) throw new Error("candidate_id is required");

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Gather scoring parameters
    const { data: candidate, error: cErr } = await supabase
      .from("candidates")
      .select("id, org_id, first_name, last_name, position_applied_for, interview_stage, current_status, source, total_experience_years, key_skills, current_ctc_lakhs, expected_ctc_lakhs, resume_url, is_fresh_application, last_call_date, next_call_date, latest_disposition, rating, highest_qualification, current_company, current_location")
      .eq("id", candidate_id)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!candidate) throw new Error("Candidate not found");

    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString();
    const { data: calls } = await supabase
      .from("call_logs")
      .select("status, disposition, conversation_duration, created_at, call_method")
      .eq("candidate_id", candidate_id)
      .gte("created_at", since)
      .limit(50);

    const callHistory = calls || [];
    const params = {
      interview_stage: candidate.interview_stage,
      current_status: candidate.current_status,
      source: candidate.source,
      total_experience_years: candidate.total_experience_years,
      has_resume: !!candidate.resume_url,
      is_fresh_application: candidate.is_fresh_application,
      key_skills_count: candidate.key_skills ? candidate.key_skills.split(",").length : 0,
      has_ctc: !!(candidate.current_ctc_lakhs || candidate.expected_ctc_lakhs),
      has_location: !!candidate.current_location,
      has_company: !!candidate.current_company,
      has_qualification: !!candidate.highest_qualification,
      latest_disposition: candidate.latest_disposition,
      rating: candidate.rating,
      call_count: callHistory.length,
      connected_calls: callHistory.filter((c: any) => (c.conversation_duration || 0) > 5).length,
      positive_dispositions: callHistory.filter((c: any) =>
        c.disposition && ["interested","callback","shortlisted","schedule interview"].some(d =>
          c.disposition.toLowerCase().includes(d)
        )
      ).length,
      days_since_last_call: candidate.last_call_date
        ? Math.floor((Date.now() - new Date(candidate.last_call_date).getTime()) / 86400000)
        : null,
    };

    const inputHash = await sha256(JSON.stringify(params));

    // Return cached result if params unchanged and not forced
    if (!force) {
      const { data: cached } = await supabase
        .from("candidate_ai_scores")
        .select("*")
        .eq("candidate_id", candidate_id)
        .maybeSingle();
      if (cached && cached.input_hash === inputHash) {
        return new Response(JSON.stringify({ ...cached, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const userMessage = `Score this candidate and return structured JSON.

Candidate: ${candidate.first_name} ${candidate.last_name}
Position Applied For: ${candidate.position_applied_for || "Not specified"}
Interview Stage: ${params.interview_stage || "None"}
Current Status: ${params.current_status}
Source: ${params.source || "Unknown"}
Experience: ${params.total_experience_years != null ? `${params.total_experience_years} years` : "Not stated"}
Key Skills: ${candidate.key_skills || "None listed"}
CTC: ${candidate.current_ctc_lakhs ? `Current ₹${candidate.current_ctc_lakhs}L` : "Not stated"}${candidate.expected_ctc_lakhs ? `, Expected ₹${candidate.expected_ctc_lakhs}L` : ""}
Qualification: ${candidate.highest_qualification || "Not stated"}
Resume Uploaded: ${params.has_resume ? "Yes" : "No"}
Fresh / Inbound Application: ${params.is_fresh_application ? "Yes" : "No"}
Rating (manual): ${candidate.rating != null ? `${candidate.rating}/5` : "None"}

Call History (last 90 days):
- Total calls: ${params.call_count}
- Connected calls (>5s): ${params.connected_calls}
- Positive dispositions: ${params.positive_dispositions}
- Days since last call: ${params.days_since_last_call != null ? params.days_since_last_call : "Never called"}
- Latest disposition: ${params.latest_disposition || "None"}`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!resp.ok) throw new Error(`Claude API error: ${resp.status} ${await resp.text()}`);
    const aiResp = await resp.json();
    const text = aiResp.content?.[0]?.text || "";
    let result: any;
    try {
      result = JSON.parse(text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());
    } catch {
      throw new Error(`Failed to parse AI response: ${text}`);
    }

    const row = {
      candidate_id,
      org_id: candidate.org_id,
      score: result.score,
      category: result.category,
      breakdown: result.breakdown,
      reasoning: result.reasoning,
      input_hash: inputHash,
      scored_at: new Date().toISOString(),
    };

    await supabase
      .from("candidate_ai_scores")
      .upsert(row, { onConflict: "candidate_id" });

    return new Response(JSON.stringify({ ...row, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("candidate-score error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
