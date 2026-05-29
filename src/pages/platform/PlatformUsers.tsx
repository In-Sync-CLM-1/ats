import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface UserRow {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  profile: { full_name: string | null; org_id: string | null } | null;
  roles: { role: string; org_id: string | null }[];
  memberships: { org_id: string; role: string; organizations: { name: string; slug: string } | null }[];
}

export default function PlatformUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error: invokeErr } = await supabase.functions.invoke("platform-list-users", { body: {} });
      if (invokeErr || data?.error) {
        setError((invokeErr?.message || data?.error) ?? "Failed to load");
      } else {
        setUsers(data?.users ?? []);
      }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const name = u.profile?.full_name ?? "";
      const orgs = u.memberships.map((m) => m.organizations?.name ?? "").join(" ");
      return (
        (u.email?.toLowerCase().includes(q) ?? false) ||
        name.toLowerCase().includes(q) ||
        orgs.toLowerCase().includes(q)
      );
    });
  }, [users, search]);

  return (
    <div className="p-8">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every authenticated user on the platform. {users.length} total.
          </p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or org..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : error ? (
            <p className="py-12 text-center text-sm text-destructive">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {users.length === 0 ? "No users yet." : "No matches."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>System Role</TableHead>
                  <TableHead>Organizations</TableHead>
                  <TableHead>Last Sign In</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => {
                  const sysRole = u.roles[0]?.role ?? "—";
                  const orgChips = u.memberships
                    .map((m) => m.organizations?.name ?? "Unknown")
                    .filter(Boolean);
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        {u.profile?.full_name || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.email || "—"}</TableCell>
                      <TableCell>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            sysRole === "platform_admin"
                              ? "bg-purple-500/10 text-purple-700"
                              : sysRole === "admin"
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {sysRole}
                        </span>
                      </TableCell>
                      <TableCell>
                        {orgChips.length === 0 ? (
                          <span className="text-xs text-muted-foreground italic">none</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {orgChips.slice(0, 3).map((n, i) => (
                              <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                                {n}
                              </span>
                            ))}
                            {orgChips.length > 3 && (
                              <span className="text-[11px] text-muted-foreground">+{orgChips.length - 3}</span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {u.last_sign_in_at
                          ? formatDistanceToNow(new Date(u.last_sign_in_at), { addSuffix: true })
                          : "Never"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
