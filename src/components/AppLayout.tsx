import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { toast } from "sonner";
import { logError, getSupabaseErrorMessage } from "@/lib/errorLogger";
import { OnboardingProvider } from "@/components/onboarding/OnboardingProvider";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { OnboardingTrigger } from "@/components/onboarding/OnboardingTrigger";
import { FeatureAnnouncementBanner } from "@/components/onboarding/FeatureAnnouncementBanner";
import { useOrg } from "@/contexts/OrgContext";
import { NotificationBell } from "@/components/NotificationBell";
import { AnnouncementBell } from "@/components/AnnouncementBell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Plus, Menu, LucideIcon } from "lucide-react";

interface HeaderConfig {
  showSearch: boolean;
  searchPlaceholder?: string;
  primaryAction: {
    label: string;
    path: string;
    icon: LucideIcon;
  } | null;
}

const getHeaderConfig = (path: string): HeaderConfig => {
  // Candidates-related pages - show search + Add Candidate
  if (path.startsWith('/candidates')) {
    return {
      showSearch: true,
      searchPlaceholder: "Search candidates...",
      primaryAction: { label: "Add Candidate", path: "/candidates/new", icon: Plus }
    };
  }
  
  // Mandates page - show search + Add Mandate
  if (path.startsWith('/mandates')) {
    return {
      showSearch: true,
      searchPlaceholder: "Search mandates...",
      primaryAction: { label: "Add Mandate", path: "/mandates/new", icon: Plus }
    };
  }
  
  // Clients page - show search + Add Client
  if (path.startsWith('/clients')) {
    return {
      showSearch: true,
      searchPlaceholder: "Search clients...",
      primaryAction: { label: "Add Client", path: "/clients/new", icon: Plus }
    };
  }
  
  // Dashboard/Analytics pages - no search, no primary action
  if (['/dashboard', '/recruiter-performance', '/calling-dashboard'].includes(path)) {
    return {
      showSearch: false,
      primaryAction: null
    };
  }
  
  // Admin/Settings pages - hide search and add button
  if (['/users', '/teams', '/designations', '/pipeline-stages', '/sites', '/webhooks', '/templates', '/headcount-agreements', '/tasks', '/my-profile', '/whats-new', '/call-dispositions'].includes(path)) {
    return {
      showSearch: false,
      primaryAction: null
    };
  }
  
  // Default - minimal header
  return { showSearch: false, primaryAction: null };
};

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentOrg, isPlatformAdmin, loading: orgLoading } = useOrg();
  const [user, setUser] = useState<User | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Gate: once auth + org context are ready, send users to the right place.
  // Platform admins go to the command center; regular users without an org go
  // to org creation; orgs with incomplete onboarding go to the wizard.
  useEffect(() => {
    if (isLoading || orgLoading || !user) return;
    if (isPlatformAdmin) {
      navigate("/platform-admin", { replace: true });
      return;
    }
    if (!currentOrg) {
      navigate("/create-org", { replace: true });
      return;
    }
    if (!currentOrg.onboarding_completed) {
      navigate("/onboarding", { replace: true });
    }
  }, [isLoading, orgLoading, user, isPlatformAdmin, currentOrg, navigate]);

  useEffect(() => {
    // Check authentication
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          logError(error, {
            component: "AppLayout",
            operation: "AUTH_SESSION",
          });
          navigate("/");
          return;
        }
        
        if (!session) {
          navigate("/");
          return;
        }
        
        setUser(session.user);
        
        // Fetch user roles
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id);
        
        const roles = rolesData?.map(r => r.role) || [];
        setUserRoles(roles);
        
        // Check if user is ONLY a zonal coordinator (redirect to zonal portal)
        const isOnlyZonalCoordinator = roles.includes('zonal_coordinator') && 
          !roles.some(r => ['platform_admin', 'super_admin', 'admin_administration', 'admin_tech', 'admin', 'manager', 'agent'].includes(r));
        
        if (isOnlyZonalCoordinator) {
          navigate("/zonal-coordinator");
          return;
        }
        
        setIsLoading(false);
      } catch (error) {
        logError(error, {
          component: "AppLayout",
          operation: "AUTH_CHECK",
        });
        navigate("/");
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        navigate("/");
      } else if (session) {
        setUser(session.user);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success("Signed out successfully");
      navigate("/");
    } catch (error: any) {
      logError(error, {
        component: "AppLayout",
        operation: "AUTH_LOGOUT",
        userId: user?.id,
      });
      toast.error(getSupabaseErrorMessage(error));
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/candidates?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const getInitials = (name?: string | null, email?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email?.slice(0, 2).toUpperCase() || 'U';
  };

  const getPageTitle = () => {
    const path = location.pathname;
    const titles: Record<string, string> = {
      '/dashboard': 'Dashboard',
      '/calling-dashboard': 'Calling Dashboard',
      '/recruiter-performance': 'Recruiter Performance',
      '/mandates': 'Mandates',
      '/candidates': 'Candidates',
      '/advanced-filter': 'Advanced Filter',
      '/tasks': 'Tasks',
      '/clients': 'Clients',
      '/templates': 'Templates',
      '/users': 'Users',
      '/teams': 'Teams',
      '/designations': 'Designations',
      '/pipeline-stages': 'Pipeline Stages',
      '/sites': 'Sites',
      '/headcount-agreements': 'Headcount Agreements',
      '/webhooks': 'Webhooks',
      '/my-profile': 'My Profile',
      '/zonal-coordinator': 'Headcount Dashboard',
      '/zonal-coordinator/headcount': 'Headcount Management',
    };
    return titles[path] || 'Dashboard';
  };

  // Wait for auth + org context to load AND for any redirect-eligible state
  // to clear before rendering the main app shell. Without this, dashboard pages
  // would briefly mount and fire queries before being redirected away.
  const redirectPending =
    !!user && !orgLoading &&
    (isPlatformAdmin || !currentOrg || !currentOrg.onboarding_completed);

  if (isLoading || orgLoading || redirectPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const headerConfig = getHeaderConfig(location.pathname);

  return (
    <OnboardingProvider>
      <SidebarProvider defaultOpen={true}>
        <div className="min-h-screen flex w-full bg-muted/30">
          <AppSidebar user={user} userRoles={userRoles} onLogout={handleLogout} />
          
          <main className="flex-1 overflow-auto">
            {/* Top Header Bar */}
            <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
              <div className="flex items-center justify-between h-16 px-6">
                {/* Left side - Sidebar trigger and search */}
                <div className="flex items-center gap-4 flex-1">
                  <SidebarTrigger className="text-muted-foreground hover:text-foreground">
                    <Menu className="h-5 w-5" />
                  </SidebarTrigger>
                  
                  {headerConfig.showSearch && (
                    <form onSubmit={handleSearch} className="relative max-w-md flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="search"
                        placeholder={headerConfig.searchPlaceholder || "Search..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/50 rounded-xl"
                      />
                    </form>
                  )}
                </div>

                {/* Right side - Actions and user */}
                <div className="flex items-center gap-3">
                  {headerConfig.primaryAction && (
                    <Button 
                      onClick={() => navigate(headerConfig.primaryAction!.path)}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl gap-2 shadow-sm"
                    >
                      <headerConfig.primaryAction.icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{headerConfig.primaryAction.label}</span>
                    </Button>
                  )}
                  
                  <div className="flex items-center gap-1">
                    <AnnouncementBell />
                    <NotificationBell />
                    <OnboardingTrigger />
                  </div>
                  
                  <div className="flex items-center gap-3 pl-3 border-l border-border">
                    <div className="hidden md:block text-right">
                      <p className="text-sm font-medium text-foreground leading-none">
                        {user?.user_metadata?.full_name || 'User'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {userRoles[0]?.replace(/_/g, ' ') || 'Member'}
                      </p>
                    </div>
                    <Avatar className="h-9 w-9 border-2 border-primary/20">
                      <AvatarImage src={user?.user_metadata?.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                        {getInitials(user?.user_metadata?.full_name, user?.email)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>
              </div>
            </header>

            {/* Feature announcement banner */}
            <div className="px-6 pt-4">
              <FeatureAnnouncementBanner />
            </div>

            {/* Main content */}
            <Outlet />
          </main>
        </div>
      </SidebarProvider>
      <OnboardingModal />
    </OnboardingProvider>
  );
}
