// Ghosting watchdog — the proactive follow-up engine.
// Sweeps every org for candidates sitting in Offer/Selected whose last recorded
// touch (any call) is older than the silence threshold, then:
//   1. flags them on the recruiter's desk (next_call_date = today),
//   2. opens a high-priority follow-up task for the assigned recruiter,
//   3. drops an in-app notification,
//   4. optionally queues the AI reminder call (org opt-in via AUTO_AI_FOLLOWUP).
// Invoked hourly by a Cloudflare Worker cron with an x-cron-secret header.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

// Self-contained (no _shared import) so the function deploys identically via
// the management API and the CLI bundler.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SILENCE_HOURS = Number(Deno.env.get("GHOST_SILENCE_HOURS") ?? "48");
const WATCH_STAGES = ["Offer", "Selected"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const secret = Deno.env.get("CRON_SECRET");
  if (secret && req.headers.get("x-cron-secret") !== secret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const cutoff = new Date(Date.now() - SILENCE_HOURS * 3600 * 1000).toISOString();
    const today = new Date().toISOString().slice(0, 10);

    // Candidates parked at the risky end of the funnel
    const { data: candidates, error: candErr } = await supabase
      .from("candidates")
      .select("id, org_id, first_name, last_name, phone, interview_stage, assigned_recruiter, created_by, next_call_date, is_onboarded")
      .in("interview_stage", WATCH_STAGES)
      .eq("is_onboarded", false)
      .not("assigned_recruiter", "is", null);
    if (candErr) throw candErr;

    let flagged = 0;
    const flaggedNames: string[] = [];

    for (const c of candidates ?? []) {
      // Last actual touch = most recent call of any kind
      const { data: lastCall } = await supabase
        .from("call_logs")
        .select("created_at")
        .eq("demandcom_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastTouch = lastCall?.created_at ?? null;
      if (lastTouch && lastTouch > cutoff) continue; // recently touched — fine

      // Dedup: an open ghost-risk task for this candidate already exists
      const marker = `[cand:${c.id}]`;
      const { data: openTask } = await supabase
        .from("general_tasks")
        .select("id")
        .in("status", ["pending", "in_progress"])
        .like("description", `%${marker}%`)
        .limit(1)
        .maybeSingle();
      if (openTask) continue;

      const name = `${c.first_name} ${c.last_name}`.trim();
      const silentH = lastTouch
        ? Math.round((Date.now() - new Date(lastTouch).getTime()) / 3600000)
        : SILENCE_HOURS;

      // 1. Desk flag — surfaces in My Desk "Action Today"
      if (!c.next_call_date || c.next_call_date.slice(0, 10) > today) {
        await supabase.from("candidates").update({ next_call_date: today }).eq("id", c.id);
      }

      // 2. High-priority follow-up task for the recruiter
      const dueEod = new Date();
      dueEod.setHours(18, 0, 0, 0);
      const { data: task } = await supabase
        .from("general_tasks")
        .insert({
          task_name: `Ghost-risk: ${name} — ${c.interview_stage} silent ${silentH}h`,
          description:
            `${name} is in ${c.interview_stage} with no contact for ~${silentH} hours. ` +
            `Re-engage before the hire goes cold: call, or trigger the AI follow-up from the profile. ${marker}`,
          assigned_to: c.assigned_recruiter,
          assigned_by: c.assigned_recruiter,
          due_date: dueEod.toISOString(),
          priority: "high",
          status: "pending",
        })
        .select("id")
        .single();

      // 3. In-app notification (general_task_id links to general_tasks)
      const { error: notifErr } = await supabase.from("notifications").insert({
        user_id: c.assigned_recruiter,
        general_task_id: task?.id ?? null,
        notification_type: "ghost_risk",
        title: "Candidate going quiet",
        message: `${name} (${c.interview_stage}) has had no contact for ~${silentH}h — follow up today.`,
      });
      if (notifErr) console.error(`notification insert failed for ${c.id}:`, notifErr.message);

      // 4. Optional AI redial — org opt-in, OFF by default (never dials silently)
      if (Deno.env.get("AUTO_AI_FOLLOWUP") === "1" && c.phone) {
        try {
          await supabase.functions.invoke("ai-screen-candidate", {
            body: { candidate_id: c.id },
          });
        } catch (e) {
          console.error(`AI follow-up failed for ${c.id}:`, e);
        }
      }

      flagged++;
      flaggedNames.push(name);
    }

    console.log(`ghosting-watchdog: scanned=${candidates?.length ?? 0} flagged=${flagged} [${flaggedNames.join(", ")}]`);
    return new Response(
      JSON.stringify({ success: true, scanned: candidates?.length ?? 0, flagged, flaggedNames, silenceHours: SILENCE_HOURS }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("ghosting-watchdog error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
