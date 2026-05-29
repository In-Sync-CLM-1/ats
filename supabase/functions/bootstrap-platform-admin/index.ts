// Idempotent bootstrap for the platform admin user.
// Hardcoded to a@in-sync.co.in / Amit Sengupta to avoid accidental privilege
// escalation if the function URL leaks. To bootstrap a different user, edit
// this file. Safe to run repeatedly.
//
// Steps:
//   1. Find or create the auth user.
//   2. Ensure profile row exists.
//   3. Replace user_roles with a single 'platform_admin' row (org_id = NULL).
//   4. Remove any org_memberships rows for this user (platform admins are org-agnostic).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TARGET_EMAIL = "a@in-sync.co.in";
const TARGET_PASSWORD = "Blizz26ard#";
const TARGET_FULL_NAME = "Amit Sengupta";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Lookup existing user via paginated listUsers (admin API has no email filter on listUsers v2).
    let userId: string | null = null;
    let page = 1;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) return json({ error: "listUsers failed", details: error.message }, 500);
      const found = data.users.find((u) => u.email?.toLowerCase() === TARGET_EMAIL.toLowerCase());
      if (found) {
        userId = found.id;
        break;
      }
      if (data.users.length < 200) break;
      page++;
    }

    if (!userId) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: TARGET_EMAIL,
        password: TARGET_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: TARGET_FULL_NAME },
      });
      if (createErr || !created?.user) {
        return json({ error: "createUser failed", details: createErr?.message }, 500);
      }
      userId = created.user.id;
    }

    // Profile row (trigger should have inserted it; defensive upsert in case).
    await admin
      .from("profiles")
      .upsert({ id: userId, email: TARGET_EMAIL, full_name: TARGET_FULL_NAME }, { onConflict: "id" });

    // Strip any existing roles, then insert exactly one platform_admin row.
    await admin.from("user_roles").delete().eq("user_id", userId);
    const { error: roleErr } = await admin
      .from("user_roles")
      .insert({ user_id: userId, role: "platform_admin", org_id: null });
    if (roleErr) return json({ error: "insert role failed", details: roleErr.message }, 500);

    // Platform admins are org-agnostic — remove any memberships.
    await admin.from("org_memberships").delete().eq("user_id", userId);

    return json({ success: true, user_id: userId, email: TARGET_EMAIL });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
