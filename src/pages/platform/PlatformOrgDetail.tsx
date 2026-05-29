import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Building2, UserPlus, Briefcase, FileText, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";

interface Member {
  role: string;
  created_at: string;
  user_id: string;
  profiles: { email: string | null; full_name: string | null } | null;
}

interface Detail {
  organization: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    website: string | null;
    industry: string | null;
    plan: string;
    onboarding_completed: boolean;
    created_at: string;
  };
  members: Member[];
  stats: { candidates: number; mandates: number; clients: number };
}

function MetricRow({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-3 last:border-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export default function PlatformOrgDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data: resp, error: invokeErr } = await supabase.functions.invoke("manage-org", {
        body: { action: "org_detail", org_id: id },
      });
      if (invokeErr || resp?.error) {
        setError((invokeErr?.message || resp?.error) ?? "Failed to load");
      } else {
        setData(resp);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="font-medium text-destructive">Could not load organization</p>
            <p className="mt-1 text-sm text-muted-foreground">{error || "Not found"}</p>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/platform-admin/organizations">Back to organizations</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { organization: org, members, stats } = data;

  return (
    <div className="p-8">
      <Button asChild variant="ghost" size="sm" className="mb-4 gap-2 text-muted-foreground">
        <Link to="/platform-admin/organizations">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </Button>

      <div className="flex items-start gap-4">
        <Avatar className="h-16 w-16 rounded-xl">
          <AvatarImage src={org.logo_url ?? undefined} />
          <AvatarFallback className="rounded-xl bg-primary/10 text-primary">
            <Building2 className="h-7 w-7" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{org.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">/{org.slug} · {org.industry || "No industry"} · {org.plan} plan</p>
          {org.website && (
            <a href={org.website} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm text-primary hover:underline">
              {org.website}
            </a>
          )}
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            org.onboarding_completed
              ? "bg-emerald-500/10 text-emerald-700"
              : "bg-amber-500/10 text-amber-700"
          }`}
        >
          {org.onboarding_completed ? <><CheckCircle2 className="mr-1 inline h-3 w-3" />Onboarded</> : <><Clock className="mr-1 inline h-3 w-3" />Pending</>}
        </span>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <MetricRow icon={UserPlus} label="Candidates" value={stats.candidates} />
            <MetricRow icon={Briefcase} label="Mandates" value={stats.mandates} />
            <MetricRow icon={FileText} label="Clients" value={stats.clients} />
            <MetricRow icon={Building2} label="Members" value={members.length} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <MetricRow icon={Clock} label="Created" value={format(new Date(org.created_at), "PPP")} />
            <MetricRow icon={CheckCircle2} label="Plan" value={org.plan} />
            <MetricRow icon={Building2} label="Slug" value={`/${org.slug}`} />
            <MetricRow icon={Building2} label="ID" value={org.id} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {members.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No members.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Org Role</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.user_id}>
                    <TableCell className="font-medium">{m.profiles?.full_name || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.profiles?.email || "—"}</TableCell>
                    <TableCell>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        {m.role}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(m.created_at), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
