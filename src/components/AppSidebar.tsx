import { NavLink, useLocation } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Mail,
  FileText,
  Building2,
  TrendingUp,
  UserPlus,
  PackageMinus,
  History,
  Webhook,
  MessageSquare,
  Sparkles,
  LogOut,
  UserCircle,
  Building,
  UsersRound,
  Contact,
  BadgeCheck,
  UserCog,
  Users2,
  Clock,
  Calendar,
  CheckSquare,
  BarChart3,
  ListTodo,
  ClipboardCheck,
  Settings,
  Package,
  Package2,
  Target,
  Phone,
  MapPin,
  ClipboardList,
  HelpCircle,
} from "lucide-react";
import { getRolePermissions, Permissions } from "@/lib/rolePermissions";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import atsLogo from "@/assets/ats-logo.png";

interface NavigationItem {
  title: string;
  url: string;
  icon: any;
  requiredPermission?: keyof Permissions;
}

interface NavigationSection {
  label: string;
  items: NavigationItem[];
}

const navigationSections: NavigationSection[] = [
  {
    label: "DASHBOARDS & REPORTS",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Recruiter Performance", url: "/recruiter-performance", icon: BarChart3 },
      { title: "Calling Dashboard", url: "/calling-dashboard", icon: Phone },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { title: "Mandates", url: "/mandates", icon: Briefcase },
      { title: "Candidates", url: "/candidates", icon: Contact },
      { title: "HR Onboarding", url: "/hr-onboarding", icon: ClipboardCheck },
    ],
  },
  {
    label: "MANAGEMENT",
    items: [
      { title: "Tasks", url: "/tasks", icon: ListTodo },
      { title: "Clients", url: "/clients", icon: Building },
      { title: "Templates", url: "/templates", icon: FileText },
    ],
  },
  {
    label: "HEADCOUNT MANAGEMENT",
    items: [
      { title: "Headcount Dashboard", url: "/zonal-coordinator", icon: ClipboardList, requiredPermission: 'canViewZonalDashboard' },
      { title: "Headcount Management", url: "/zonal-coordinator/headcount", icon: Target, requiredPermission: 'canManageHeadcount' },
      { title: "Headcount Agreements", url: "/headcount-agreements", icon: ClipboardList, requiredPermission: 'canViewHeadcountAgreements' },
      { title: "Sites", url: "/sites", icon: MapPin, requiredPermission: 'canViewSites' },
    ],
  },
  {
    label: "ADMINISTRATION",
    items: [
      { title: "Users", url: "/users", icon: UserCog, requiredPermission: 'canViewUsers' },
      { title: "Teams", url: "/teams", icon: Users2, requiredPermission: 'canViewTeams' },
      { title: "Designations", url: "/designations", icon: BadgeCheck, requiredPermission: 'canViewDesignations' },
      { title: "Pipeline Stages", url: "/pipeline-stages", icon: TrendingUp, requiredPermission: 'canViewPipelineStages' },
    ],
  },
  {
    label: "TECH ADMIN",
    items: [
      { title: "Webhooks", url: "/webhooks", icon: Webhook, requiredPermission: 'canViewWebhooks' },
    ],
  },
];

interface AppSidebarProps {
  user: User | null;
  userRoles: string[];
  onLogout: () => void;
}

export function AppSidebar({ user, userRoles, onLogout }: AppSidebarProps) {
  const location = useLocation();
  const currentPath = location.pathname;
  const permissions = getRolePermissions(userRoles);

  const isActive = (path: string) => currentPath === path;
  
  // Check if user is ONLY a zonal coordinator (not an admin)
  const isOnlyZonalCoordinator = permissions.isZonalCoordinator && 
    !userRoles.some(r => ['platform_admin', 'super_admin', 'admin_administration', 'admin_tech', 'admin', 'manager'].includes(r));

  const getVisibleSections = () => {
    // If user is only a zonal coordinator, show only Headcount Management section
    if (isOnlyZonalCoordinator) {
      return navigationSections
        .filter(section => section.label === "HEADCOUNT MANAGEMENT")
        .map(section => ({
          ...section,
          items: section.items.filter(item => {
            if (!item.requiredPermission) return true;
            return permissions[item.requiredPermission];
          })
        }))
        .filter(section => section.items.length > 0);
    }

    return navigationSections
      .map(section => ({
        ...section,
        items: section.items.filter(item => {
          if (!item.requiredPermission) return true;
          return permissions[item.requiredPermission];
        })
      }))
      .filter(section => section.items.length > 0);
  };
  
  const visibleSections = getVisibleSections();

  return (
    <Sidebar collapsible="icon" className="bg-sidebar border-r-0">
      <SidebarHeader className="border-b border-sidebar-border bg-sidebar">
        <div className="p-5">
          <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
            <img src={atsLogo} alt="Logo" className="w-[80%] h-auto mx-auto transition-all duration-300 hover:scale-105 brightness-0 invert" />
          </div>
          <div className="group-data-[collapsible=icon]:hidden text-center mt-4">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">
              {user?.user_metadata?.full_name || user?.email}
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-sidebar overflow-y-auto scrollbar-hide">
        {visibleSections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel className="text-[10px] font-semibold text-sidebar-foreground/50 uppercase tracking-wider px-4 py-2.5 group-data-[collapsible=icon]:hidden">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="px-3">
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        isActive
                          ? "flex items-center gap-3 px-4 py-2.5 w-full text-white bg-sidebar-primary font-semibold transition-all rounded-lg"
                          : "flex items-center gap-3 px-4 py-2.5 w-full bg-transparent text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all rounded-lg"
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="text-sm group-data-[collapsible=icon]:hidden">{item.title}</span>
                    </NavLink>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border bg-sidebar p-4">
        {/* Help Section */}
        <div className="bg-sidebar-accent/50 rounded-xl p-4 mb-3 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-sidebar-primary/20 flex items-center justify-center">
              <HelpCircle className="h-4 w-4 text-sidebar-primary" />
            </div>
            <span className="text-xs font-medium text-sidebar-foreground">Need help?</span>
          </div>
          <p className="text-[11px] text-sidebar-foreground/60 mb-2">Contact our support team for assistance</p>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full text-xs bg-sidebar-primary/10 hover:bg-sidebar-primary/20 text-sidebar-primary"
          >
            Get Support
          </Button>
        </div>

        <SidebarMenu>
          <SidebarMenuItem>
            <NavLink
              to="/my-profile"
              className={({ isActive }) =>
                isActive
                  ? "flex items-center gap-3 px-4 py-2.5 w-full text-white bg-sidebar-primary font-semibold transition-all rounded-lg"
                  : "flex items-center gap-3 px-4 py-2.5 w-full bg-transparent text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all rounded-lg"
              }
            >
              <UserCircle className="h-4 w-4" />
              <span className="text-sm group-data-[collapsible=icon]:hidden">My Profile</span>
            </NavLink>
          </SidebarMenuItem>
        </SidebarMenu>
        <Button
          variant="ghost"
          onClick={onLogout}
          className="flex items-center gap-3 px-4 py-2.5 text-sidebar-foreground/80 hover:bg-red-500/20 hover:text-red-400 transition-all rounded-lg w-full justify-start mt-1"
        >
          <LogOut className="h-4 w-4" />
          <span className="text-sm group-data-[collapsible=icon]:hidden">Logout</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
