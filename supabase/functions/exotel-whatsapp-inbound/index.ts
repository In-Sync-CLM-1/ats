// Inbound WhatsApp webhook (Exotel → ATS).
// Point the WABA's incoming-message callback at this function. Each reply is
// matched to a candidate by phone (last 10 digits), stored on the thread, and
// the assigned recruiter gets an in-app notification.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Exotel's WhatsApp callback shapes vary by product version — walk the payload
// and pull out (from, text) pairs wherever they appear.
function extractMessages(payload: unknown): Array<{ from: string; body: string; sid: string | null }> {
  const found: Array<{ from: string; body: string; sid: string | null }> = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!node || typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    const from = (o.from ?? o.From ?? o.from_number) as string | undefined;
    const textObj = o.content && typeof o.content === "object" ? (o.content as any).text : undefined;
    const body = (textObj?.body ?? o.body ?? o.Body ?? o.text) as string | undefined;
    if (from && typeof body === "string" && body.trim()) {
      found.push({
        from: String(from),
        body: body.trim(),
        sid: (o.sid ?? o.Sid ?? o.message_sid ?? null) as string | null,
      });
    }
    Object.values(o).forEach(visit);
  };
  visit(payload);
  // Dedup identical (from, body) pairs discovered at multiple nesting levels
  const seen = new Set<string>();
  return found.filter((m) => {
    const k = `${m.from}|${m.body}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let payload: unknown;
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      payload = await req.json();
    } else {
      const form = await req.formData().catch(() => null);
      payload = form ? Object.fromEntries(form.entries()) : await req.text();
    }

    const messages = extractMessages(payload);
    if (!messages.length) {
      console.log("inbound webhook: no message content found", JSON.stringify(payload).slice(0, 500));
      return new Response(JSON.stringify({ ok: true, stored: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let stored = 0;
    for (const m of messages) {
      const last10 = m.from.replace(/\D/g, "").slice(-10);
      if (last10.length < 10) continue;

      // Match the sender to a candidate by phone
      const { data: candidate } = await supabase
        .from("candidates")
        .select("id, org_id, first_name, last_name, assigned_recruiter")
        .like("phone", `%${last10}`)
        .limit(1)
        .maybeSingle();

      await supabase.from("whatsapp_messages").insert({
        org_id: candidate?.org_id ?? null,
        candidate_id: candidate?.id ?? null,
        phone: last10,
        direction: "inbound",
        body: m.body,
        exotel_sid: m.sid,
        status: "received",
        raw: typeof payload === "object" ? payload : { raw: String(payload) },
      });
      stored++;

      if (candidate?.assigned_recruiter) {
        await supabase.from("notifications").insert({
          user_id: candidate.assigned_recruiter,
          notification_type: "whatsapp_reply",
          title: "WhatsApp reply",
          message: `${candidate.first_name} ${candidate.last_name}: "${m.body.slice(0, 140)}"`,
        });
      }
    }

    console.log(`inbound webhook: stored ${stored} message(s)`);
    return new Response(JSON.stringify({ ok: true, stored }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("exotel-whatsapp-inbound error:", error);
    // Always 200 to the provider — webhook retries won't fix a parse error
    return new Response(JSON.stringify({ ok: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
