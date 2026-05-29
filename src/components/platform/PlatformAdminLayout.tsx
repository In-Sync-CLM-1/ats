import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { LayoutDashboard, Building2, Users as UsersIcon, LogOut, ShieldCheck } from "lucide-react";

const NAV_ITEMS = [
  { to: "/platform-admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/platform-admin/organizations", label: "Organizations", icon: Building2, end: false },
  { to: "/platform-admin/users", label: "Users", icon: UsersIcon, end: false },
];

export default function PlatformAdminLayout() {
  const navigate = useNavigate();
  const { isPlatformAdmin, loading: orgLoading } = useOrg();
  const [authChecked, setAuthChecked] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth", { replace: true });
        return;
      }
      setEmail(session.user.email ?? null);
      setFullName((session.user.user_metadata as any)?.full_name ?? null);
      setAuthChecked(true);
    });
  }, [navigate]);

  // Once both auth + org context resolve, kick non-platform-admins out.
  useEffect(() => {
    if (!authChecked || orgLoading) return;
    if (!isPlatformAdmin) navigate("/dashboard", { replace: true });
  }, [authChecked, orgLoading, isPlatformAdmin, navigate]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate("/auth", { replace: true });
  };

  if (!authChecked || orgLoading || !isPlatformAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const initials = (fullName || email || "PA")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex min-h-screen bg-muted/20">
      {/* ── Sidebar ── */}
      <aside className="flex w-64 flex-col border-r border-border bg-background">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">Command Center</p>
            <p className="text-[11px] text-muted-foreground">Platform Admin</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-lg p-2">
            <Avatar className="h-9 w-9 border-2 border-primary/20">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{fullName || "Platform Admin"}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="mt-2 w-full justify-start gap-2 text-muted-foreground">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
