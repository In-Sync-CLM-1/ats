import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an HR document verification specialist. Analyze onboarding submissions for potential issues, missing documents, or format errors.

Return ONLY valid JSON — no prose, no markdown fences:
{
  "risk_score": <0-100 integer — 0=no issues, 100=high risk/fraud>,
  "findings": [
    { "category": "<string>", "severity": "low|medium|high", "description": "<string>" }
  ],
  "recommendation": "approve|review|reject",
  "summary": "<2-3 sentence human-readable summary>"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { submission_id } = await req.json();
    if (!submission_id) throw new Error("Missing submission_id");

    const { data: sub } = await supabase
      .from("onboarding_submissions")
      .select("*")
      .eq("id", submission_id)
      .maybeSingle();
    if (!sub) throw new Error("Submission not found");

    const { data: docs } = await supabase
      .from("onboarding_documents")
      .select("*")
      .eq("submission_id", submission_id);

    const REQUIRED_DOCS = ["aadhaar", "pan", "cancelled_cheque"];
    const uploadedTypes = (docs || []).map((d: any) => d.document_type);
    const missingDocs = REQUIRED_DOCS.filter(d => !uploadedTypes.includes(d));

    const docSummary = (docs || []).map((d: any) =>
      `- ${d.document_type}: ${d.file_name} (${d.file_size ? Math.round(d.file_size / 1024) + "KB" : "unknown size"})`
    ).join("\n");

    const prompt = `Analyze this candidate onboarding submission for an ATS (recruitment system).

Submission Details:
- Name: ${sub.full_name}
- Gender: ${sub.gender || "Not provided"}
- Date of Birth: ${sub.date_of_birth || "Not provided"}
- Contact: ${sub.contact_number}
- Email: ${sub.personal_email} (Verified: ${sub.email_verified ? "Yes" : "No"})
- PAN: ${sub.pan_number || "Not provided"}
- Aadhaar: ${sub.aadhar_number || "Not provided"}
- Bank: ${sub.bank_name || "Not provided"}, Account: ${sub.account_number ? "****" + sub.account_number.slice(-4) : "Not provided"}, IFSC: ${sub.ifsc_code || "Not provided"}
- Qualifications: ${sub.qualifications || "Not provided"}
- Present Address: ${sub.present_address ? "Provided" : "Not provided"}

Documents Uploaded:
${docSummary || "No documents uploaded"}
${missingDocs.length > 0 ? `\nMissing required documents: ${missingDocs.join(", ")}` : ""}

Check for:
1. PAN format validity (should be ABCDE1234F — 5 letters, 4 digits, 1 letter)
2. Aadhaar format (should be 12 digits)
3. IFSC format (should be 4 letters + 0 + 6 alphanumeric)
4. Missing critical documents (Aadhaar, PAN, cancelled cheque are required)
5. Email not verified
6. Any obvious inconsistencies`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 768,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!resp.ok) throw new Error(`Claude API error: ${resp.status}`);
    const claudeData = await resp.json();
    const rawText = claudeData.content?.[0]?.text || "";

    let analysis: any;
    try {
      analysis = JSON.parse(rawText.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());
    } catch {
      throw new Error(`Failed to parse AI response: ${rawText}`);
    }

    await supabase.from("onboarding_submissions").update({
      ai_review_result: analysis,
      ai_review_at: new Date().toISOString(),
      status: "documents_under_review",
    }).eq("id", submission_id);

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("analyze-onboarding-document error:", err);
    return new Response(JSON.stringify({ error: err.message || "Analysis failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
