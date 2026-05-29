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

// Hardcoded allowlist for destructive cross-org operations (mirrors wa pattern).
const DELETE_ALLOWLIST = ["a@in-sync.co.in", "amina@in-sync.co.in"];

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Optional: resolve caller from JWT if present.
    let caller: { id: string; email?: string | null } | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data, error } = await admin.auth.getUser(token);
      if (!error && data.user) caller = { id: data.user.id, email: data.user.email };
    }

    const requireAuth = () => {
      if (!caller) throw new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      return caller;
    };

    const isPlatformAdmin = async (userId: string) => {
      const { data } = await admin.rpc("is_platform_admin", { _user_id: userId });
      return !!data;
    };

    const isOrgAdmin = async (userId: string, orgId: string) => {
      if (await isPlatformAdmin(userId)) return true;
      const { data } = await admin
        .from("org_memberships")
        .select("role")
        .eq("org_id", orgId)
        .eq("user_id", userId)
        .maybeSingle();
      return data?.role === "org_admin";
    };

    const body = await req.json();
    const { action } = body;

    // ── CREATE ORG (public + authenticated) ──
    // Public: requires email/password/full_name; creates auth user, signs them in,
    //         returns session. Authenticated: uses caller's id, no user creation.
    if (action === "create") {
      const { name, slug, industry, email, password, full_name } = body;
      if (!name) return json({ error: "name is required" }, 400);

      const finalSlug = slugify(slug || name);
      if (!finalSlug) return json({ error: "slug could not be derived from name" }, 400);

      let userId: string;
      let session: unknown = null;

      if (caller) {
        userId = caller.id;
      } else {
        if (!email || !password || !full_name) {
          return json({ error: "email, password and full_name are required for public signup" }, 400);
        }
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name },
        });
        if (createErr || !created?.user) {
          return json({ error: "Failed to create user", details: createErr?.message }, 400);
        }
        userId = created.user.id;

        // Sign in immediately so the client gets a session.
        const anon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
        const { data: signInData, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
        if (signInErr) {
          return json({ error: "User created but sign-in failed", details: signInErr.message }, 500);
        }
        session = signInData.session;
      }

      // Create org
      const { data: org, error: orgError } = await admin
        .from("organizations")
        .insert({ name, slug: finalSlug, industry: industry || null, created_by: userId })
        .select()
        .single();
      if (orgError) return json({ error: "Failed to create org", details: orgError.message }, 400);

      // Membership: org_admin
      const { error: memberError } = await admin
        .from("org_memberships")
        .insert({ org_id: org.id, user_id: userId, role: "org_admin" });
      if (memberError) {
        await admin.from("organizations").delete().eq("id", org.id);
        return json({ error: "Failed to create membership", details: memberError.message }, 500);
      }

      // System-wide role: 'admin' (NOT 'agent'). Replace any pre-existing role row
      // for this user (defensive; the trigger no longer inserts one).
      await admin.from("user_roles").delete().eq("user_id", userId);
      const { error: roleError } = await admin
        .from("user_roles")
        .insert({ user_id: userId, role: "admin", org_id: org.id });
      if (roleError) {
        await admin.from("organizations").delete().eq("id", org.id);
        return json({ error: "Failed to assign admin role", details: roleError.message }, 500);
      }

      // Profile org_id + empty credentials row
      await admin.from("profiles").update({ org_id: org.id }).eq("id", userId);
      await admin.from("org_credentials").insert({ org_id: org.id });

      return json({ success: true, organization: org, session });
    }

    // ── UPDATE ORG ──
    if (action === "update") {
      const { id: userId } = requireAuth();
      const { org_id, name, logo_url, website, industry } = body;
      if (!org_id) return json({ error: "org_id required" }, 400);
      if (!(await isOrgAdmin(userId, org_id))) return json({ error: "Forbidden" }, 403);

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (name !== undefined) updates.name = name;
      if (logo_url !== undefined) updates.logo_url = logo_url;
      if (website !== undefined) updates.website = website;
      if (industry !== undefined) updates.industry = industry;

      const { data: updated, error } = await admin
        .from("organizations")
        .update(updates)
        .eq("id", org_id)
        .select()
        .single();
      if (error) return json({ error: "Update failed", details: error.message }, 500);
      return json({ success: true, organization: updated });
    }

    // ── COMPLETE ONBOARDING ──
    if (action === "complete_onboarding") {
      const { id: userId } = requireAuth();
      const { org_id } = body;
      if (!org_id) return json({ error: "org_id required" }, 400);
      if (!(await isOrgAdmin(userId, org_id))) return json({ error: "Forbidden" }, 403);

      const { error } = await admin
        .from("organizations")
        .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
        .eq("id", org_id);
      if (error) return json({ error: "Failed to complete onboarding", details: error.message }, 500);
      return json({ success: true });
    }

    // ── SEED PIPELINE STAGES (idempotent) ──
    if (action === "seed_pipeline_stages") {
      const { id: userId } = requireAuth();
      const { org_id, stages } = body as { org_id: string; stages: { name: string; order: number; color?: string }[] };
      if (!org_id || !Array.isArray(stages) || stages.length === 0) {
        return json({ error: "org_id and stages[] required" }, 400);
      }
      if (!(await isOrgAdmin(userId, org_id))) return json({ error: "Forbidden" }, 403);

      const { count: existing } = await admin
        .from("pipeline_stages")
        .select("id", { count: "exact", head: true })
        .eq("org_id", org_id);
      if ((existing ?? 0) > 0) return json({ success: true, count: 0, skipped: true });

      const rows = stages.map((s) => ({
        org_id,
        name: s.name,
        stage_order: s.order,
        color: s.color || "#6366f1",
        stage_type: "candidate",
        is_active: true,
      }));
      const { error } = await admin.from("pipeline_stages").insert(rows);
      if (error) return json({ error: "Failed to seed pipeline stages", details: error.message }, 500);
      return json({ success: true, count: rows.length });
    }

    // ── SEED DESIGNATIONS ──
    if (action === "seed_designations") {
      const { id: userId } = requireAuth();
      const { org_id, designations } = body as { org_id: string; designations: string[] };
      if (!org_id || !Array.isArray(designations) || designations.length === 0) {
        return json({ error: "org_id and designations[] required" }, 400);
      }
      if (!(await isOrgAdmin(userId, org_id))) return json({ error: "Forbidden" }, 403);

      const rows = designations.map((title) => ({ org_id, title, is_active: true }));
      const { error } = await admin
        .from("designations")
        .upsert(rows, { onConflict: "org_id,title", ignoreDuplicates: true });
      if (error) return json({ error: "Failed to seed designations", details: error.message }, 500);
      return json({ success: true, count: rows.length });
    }

    // ── LIST ORGS (platform admin only) ──
    if (action === "list_orgs") {
      const { id: userId } = requireAuth();
      if (!(await isPlatformAdmin(userId))) return json({ error: "Forbidden" }, 403);

      const { data: orgs, error } = await admin
        .from("organizations")
        .select("id, name, slug, industry, plan, logo_url, onboarding_completed, created_at, updated_at, created_by")
        .order("created_at", { ascending: false });
      if (error) return json({ error: "Failed to list orgs", details: error.message }, 500);

      // Aggregate counts per org
      const ids = (orgs ?? []).map((o) => o.id);
      const counts: Record<string, { members: number; candidates: number; mandates: number; clients: number }> = {};
      for (const id of ids) counts[id] = { members: 0, candidates: 0, mandates: 0, clients: 0 };

      for (const [table, key] of [
        ["org_memberships", "members"],
        ["candidates", "candidates"],
        ["mandates", "mandates"],
        ["clients", "clients"],
      ] as const) {
        const { data } = await admin.from(table).select("org_id").in("org_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
        for (const row of data ?? []) {
          const o = (row as { org_id: string }).org_id;
          if (counts[o]) counts[o][key as "members"]++;
        }
      }

      return json({
        success: true,
        organizations: (orgs ?? []).map((o) => ({ ...o, stats: counts[o.id] ?? { members: 0, candidates: 0, mandates: 0, clients: 0 } })),
      });
    }

    // ── ORG DETAIL (platform admin only) ──
    if (action === "org_detail") {
      const { id: userId } = requireAuth();
      const { org_id } = body;
      if (!org_id) return json({ error: "org_id required" }, 400);
      if (!(await isPlatformAdmin(userId))) return json({ error: "Forbidden" }, 403);

      const { data: org } = await admin.from("organizations").select("*").eq("id", org_id).maybeSingle();
      if (!org) return json({ error: "Organization not found" }, 404);

      const { data: members } = await admin
        .from("org_memberships")
        .select("role, created_at, user_id, profiles:user_id(email, full_name)")
        .eq("org_id", org_id);

      const [{ count: candidates }, { count: mandates }, { count: clients }] = await Promise.all([
        admin.from("candidates").select("id", { count: "exact", head: true }).eq("org_id", org_id),
        admin.from("mandates").select("id", { count: "exact", head: true }).eq("org_id", org_id),
        admin.from("clients").select("id", { count: "exact", head: true }).eq("org_id", org_id),
      ]);

      return json({
        success: true,
        organization: org,
        members: members ?? [],
        stats: { candidates: candidates ?? 0, mandates: mandates ?? 0, clients: clients ?? 0 },
      });
    }

    // ── DELETE ORG (platform admin in allowlist only) ──
    if (action === "delete") {
      const { id: userId, email } = requireAuth();
      const { org_id } = body;
      if (!org_id) return json({ error: "org_id required" }, 400);
      if (!(await isPlatformAdmin(userId)) || !email || !DELETE_ALLOWLIST.includes(email.toLowerCase())) {
        return json({ error: "Forbidden" }, 403);
      }
      const { error } = await admin.from("organizations").delete().eq("id", org_id);
      if (error) return json({ error: "Delete failed", details: error.message }, 500);
      return json({ success: true });
    }

    return json({
      error:
        "Invalid action. Use: create, update, complete_onboarding, seed_pipeline_stages, seed_designations, list_orgs, org_detail, delete",
    }, 400);
  } catch (err) {
    if (err instanceof Response) return err;
    return json({ error: (err as Error).message }, 500);
  }
});
