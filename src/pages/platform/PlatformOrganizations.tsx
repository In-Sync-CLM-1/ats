import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Search, Trash2, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Org {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  plan: string;
  onboarding_completed: boolean;
  created_at: string;
  stats: { members: number; candidates: number; mandates: number; clients: number };
}

const DELETE_ALLOWLIST = ["a@in-sync.co.in", "amina@in-sync.co.in"];

export default function PlatformOrganizations() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [callerEmail, setCallerEmail] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("manage-org", { body: { action: "list_orgs" } });
    if (error || data?.error) {
      toast.error((error?.message || data?.error) ?? "Failed to load");
    } else {
      setOrgs(data?.organizations ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCallerEmail(session?.user?.email ?? null);
    });
  }, []);

  const canDelete = !!callerEmail && DELETE_ALLOWLIST.includes(callerEmail.toLowerCase());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.slug.toLowerCase().includes(q) ||
        (o.industry?.toLowerCase().includes(q) ?? false),
    );
  }, [orgs, search]);

  const handleDelete = async (org: Org) => {
    if (confirmName !== org.name) {
      toast.error("Type the organization name to confirm.");
      return;
    }
    setDeletingId(org.id);
    const { data, error } = await supabase.functions.invoke("manage-org", {
      body: { action: "delete", org_id: org.id },
    });
    setDeletingId(null);
    if (error || data?.error) {
      toast.error((error?.message || data?.error) ?? "Delete failed");
      return;
    }
    toast.success(`Deleted ${org.name}`);
    setConfirmName("");
    await refresh();
  };

  return (
    <div className="p-8">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Organizations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every workspace on the platform. {orgs.length} total.
          </p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, slug, industry..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Organizations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {orgs.length === 0 ? "No organizations yet." : "No matches."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                  <TableHead className="text-right">Candidates</TableHead>
                  <TableHead className="text-right">Mandates</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link
                        to={`/platform-admin/organizations/${o.id}`}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {o.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">/{o.slug}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {o.industry || "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{o.stats.members}</TableCell>
                    <TableCell className="text-right tabular-nums">{o.stats.candidates}</TableCell>
                    <TableCell className="text-right tabular-nums">{o.stats.mandates}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(o.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          o.onboarding_completed
                            ? "bg-emerald-500/10 text-emerald-700"
                            : "bg-amber-500/10 text-amber-700"
                        }`}
                      >
                        {o.onboarding_completed ? "Onboarded" : "Pending"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                          <Link to={`/platform-admin/organizations/${o.id}`}>
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                        {canDelete && (
                          <AlertDialog onOpenChange={(open) => !open && setConfirmName("")}>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                disabled={deletingId === o.id}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete {o.name}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This permanently deletes the organization and all its data
                                  (candidates, mandates, clients, members, etc.). This cannot be
                                  undone. Type <span className="font-mono font-bold">{o.name}</span> to confirm.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <Input
                                value={confirmName}
                                onChange={(e) => setConfirmName(e.target.value)}
                                placeholder={o.name}
                                className="my-2"
                              />
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(o)}
                                  disabled={confirmName !== o.name || deletingId === o.id}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {deletingId === o.id ? "Deleting..." : "Delete forever"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
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
