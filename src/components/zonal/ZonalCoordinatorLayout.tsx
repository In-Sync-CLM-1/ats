import { useEffect, useState } from "react";
import { Outlet, useNavigate, NavLink } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { LayoutDashboard, ClipboardList, LogOut } from "lucide-react";
import { toast } from "sonner";
import atsLogo from "@/assets/ats-logo.png";

export default function ZonalCoordinatorLayout() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const checkAuthorization = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          navigate("/");
          return;
        }

        // Check if user has zonal_coordinator role
        const { data: roles, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (error) throw error;

        const hasAccess = roles?.some(
          (r) =>
            r.role === "zonal_coordinator" ||
            r.role === "admin" ||
            r.role === "super_admin" ||
            r.role === "platform_admin"
        );

        if (!hasAccess) {
          toast.error("You don't have access to the Zonal Coordinator portal");
          navigate("/dashboard");
          return;
        }

        // Get user profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.full_name) {
          setUserName(profile.full_name);
        }

        setIsAuthorized(true);
      } catch (error) {
        console.error("Error checking authorization:", error);
        toast.error("Failed to verify access");
        navigate("/");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthorization();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  const navItems = [
    { to: "/zonal-coordinator", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/zonal-coordinator/headcount", label: "Headcount", icon: ClipboardList },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-0 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={atsLogo} alt="Logo" className="h-40 w-40 object-contain" />
            <div>
              <h1 className="font-bold text-lg">Zonal Portal</h1>
              {userName && (
                <p className="text-sm text-muted-foreground">Welcome, {userName}</p>
              )}
            </div>
          </div>
          
          <nav className="flex items-center gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
