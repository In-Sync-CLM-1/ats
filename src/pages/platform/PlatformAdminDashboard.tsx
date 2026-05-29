import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users as UsersIcon, FileText, UserPlus, Briefcase, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

interface OrgStats {
  members: number;
  candidates: number;
  mandates: number;
  clients: number;
}

interface Org {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  plan: string;
  onboarding_completed: boolean;
  created_at: string;
  stats: OrgStats;
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: any;
  tone?: "primary" | "green" | "amber" | "blue";
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    green: "bg-emerald-500/10 text-emerald-600",
    amber: "bg-amber-500/10 text-amber-600",
    blue: "bg-blue-500/10 text-blue-600",
  } as const;
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tones[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PlatformAdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("manage-org", { body: { action: "list_orgs" } });
      if (error || data?.error) {
        setError((error?.message || data?.error) ?? "Failed to load");
      } else {
        setOrgs(data?.organizations ?? []);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="font-medium text-destructive">Failed to load command center</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalMembers = orgs.reduce((s, o) => s + o.stats.members, 0);
  const totalCandidates = orgs.reduce((s, o) => s + o.stats.candidates, 0);
  const totalMandates = orgs.reduce((s, o) => s + o.stats.mandates, 0);
  const totalClients = orgs.reduce((s, o) => s + o.stats.clients, 0);
  const onboardedCount = orgs.filter((o) => o.onboarding_completed).length;
  const newest = [...orgs].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 5);

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Platform Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cross-organization view of every workspace running on this ATS instance.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Organizations"
          value={orgs.length}
          hint={`${onboardedCount} onboarded · ${orgs.length - onboardedCount} pending`}
          icon={Building2}
          tone="primary"
        />
        <StatCard label="Total Users" value={totalMembers} icon={UsersIcon} tone="blue" />
        <StatCard label="Candidates" value={totalCandidates} icon={UserPlus} tone="green" />
        <StatCard label="Mandates" value={totalMandates} icon={Briefcase} tone="amber" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard label="Clients" value={totalClients} icon={FileText} tone="blue" />
        <StatCard
          label="Onboarded Orgs"
          value={onboardedCount}
          hint={orgs.length > 0 ? `${Math.round((onboardedCount / orgs.length) * 100)}%` : "0%"}
          icon={CheckCircle2}
          tone="green"
        />
        <StatCard
          label="Pending Onboarding"
          value={orgs.length - onboardedCount}
          icon={Clock}
          tone="amber"
        />
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" /> Newest Organizations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {newest.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No organizations yet.</p>
          ) : (
            <div className="space-y-2">
              {newest.map((o) => (
                <Link
                  key={o.id}
                  to={`/platform-admin/organizations/${o.id}`}
                  className="flex items-center justify-between rounded-lg border border-transparent p-3 transition-colors hover:border-border hover:bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{o.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.industry || "No industry"} · {o.stats.members} member{o.stats.members === 1 ? "" : "s"} · {o.stats.candidates} candidate{o.stats.candidates === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      o.onboarding_completed
                        ? "bg-emerald-500/10 text-emerald-700"
                        : "bg-amber-500/10 text-amber-700"
                    }`}
                  >
                    {o.onboarding_completed ? "Onboarded" : "Pending"}
                  </span>
                </Link>
              ))}
            </div>
          )}
          <div className="mt-4 text-right">
            <Link
              to="/platform-admin/organizations"
              className="text-sm font-medium text-primary hover:underline"
            >
              View all organizations →
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
