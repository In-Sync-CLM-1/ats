// Cross-org user listing for the platform admin command center.
// Returns auth users with their org memberships, last_sign_in, profile data.
// Gated by is_platform_admin().

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: callerData, error: callerErr } = await admin.auth.getUser(token);
    if (callerErr || !callerData.user) return json({ error: "Unauthorized" }, 401);

    const { data: pa } = await admin.rpc("is_platform_admin", { _user_id: callerData.user.id });
    if (!pa) return json({ error: "Forbidden" }, 403);

    // Page through all auth users (admin API).
    const allUsers: { id: string; email: string | null; created_at: string; last_sign_in_at: string | null }[] = [];
    let page = 1;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) return json({ error: "listUsers failed", details: error.message }, 500);
      for (const u of data.users) {
        allUsers.push({
          id: u.id,
          email: u.email ?? null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
        });
      }
      if (data.users.length < 200) break;
      page++;
    }

    const userIds = allUsers.map((u) => u.id);
    if (userIds.length === 0) return json({ success: true, users: [] });

    const [{ data: profiles }, { data: roles }, { data: memberships }] = await Promise.all([
      admin.from("profiles").select("id, full_name, email, org_id").in("id", userIds),
      admin.from("user_roles").select("user_id, role, org_id").in("user_id", userIds),
      admin
        .from("org_memberships")
        .select("user_id, org_id, role, organizations:org_id(name, slug)")
        .in("user_id", userIds),
    ]);

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const rolesMap = new Map<string, { role: string; org_id: string | null }[]>();
    for (const r of roles ?? []) {
      const arr = rolesMap.get((r as any).user_id) ?? [];
      arr.push({ role: (r as any).role, org_id: (r as any).org_id });
      rolesMap.set((r as any).user_id, arr);
    }
    const membershipsMap = new Map<string, any[]>();
    for (const m of memberships ?? []) {
      const arr = membershipsMap.get((m as any).user_id) ?? [];
      arr.push(m);
      membershipsMap.set((m as any).user_id, arr);
    }

    const enriched = allUsers.map((u) => ({
      ...u,
      profile: profileMap.get(u.id) ?? null,
      roles: rolesMap.get(u.id) ?? [],
      memberships: membershipsMap.get(u.id) ?? [],
    }));

    return json({ success: true, users: enriched });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
