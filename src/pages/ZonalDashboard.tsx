import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Users, Briefcase, ClipboardList, MapPin, Phone, Mail } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DashboardStats {
  totalSites: number;
  totalOpenPositions: number;
  totalMandatesCreated: number;
  totalAgreements: number;
}

interface SiteWithStats {
  id: string;
  site_name: string;
  site_code: string | null;
  location: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  client: { company_name: string } | null;
  openPositions: number;
  agreementCount: number;
}

export default function ZonalDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalSites: 0,
    totalOpenPositions: 0,
    totalMandatesCreated: 0,
    totalAgreements: 0,
  });
  const [sites, setSites] = useState<SiteWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get user profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.full_name) {
          setUserName(profile.full_name);
        }

        // Get sites where this user is the coordinator with client info
        const { data: assignedSites, count: sitesCount } = await supabase
          .from("sites")
          .select("id, site_name, site_code, location, contact_person, contact_phone, contact_email, client:clients(company_name)", { count: "exact" })
          .eq("coordinator_id", user.id);

        const siteIds = assignedSites?.map(s => s.id) || [];

        if (siteIds.length > 0) {
          // Get headcount agreements stats
          const { data: agreements } = await supabase
            .from("site_headcount_agreements")
            .select("site_id, open_positions, linked_mandate_id")
            .in("site_id", siteIds);

          const totalOpenPositions = agreements?.reduce((sum, a) => sum + (a.open_positions || 0), 0) || 0;
          const totalMandatesCreated = agreements?.filter(a => a.linked_mandate_id).length || 0;

          // Map sites with their stats
          const sitesWithStats: SiteWithStats[] = (assignedSites || []).map(site => {
            const siteAgreements = agreements?.filter(a => a.site_id === site.id) || [];
            const openPositions = siteAgreements.reduce((sum, a) => sum + (a.open_positions || 0), 0);
            return {
              ...site,
              openPositions,
              agreementCount: siteAgreements.length,
            };
          });

          setSites(sitesWithStats);
          setStats({
            totalSites: sitesCount || 0,
            totalOpenPositions,
            totalMandatesCreated,
            totalAgreements: agreements?.length || 0,
          });
        } else {
          setSites([]);
          setStats({
            totalSites: 0,
            totalOpenPositions: 0,
            totalMandatesCreated: 0,
            totalAgreements: 0,
          });
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Welcome{userName ? `, ${userName}` : ""}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Zonal Coordinator Dashboard - Manage headcount for your assigned sites
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-sm font-medium">Assigned Sites</CardDescription>
              <div className="bg-cyan-100 p-2 rounded-full">
                <Building2 className="h-4 w-4 text-cyan-600" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold text-primary">{stats.totalSites}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Sites under your management</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-sm font-medium">Open Positions</CardDescription>
              <div className="bg-green-100 p-2 rounded-full">
                <Users className="h-4 w-4 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold text-primary">{stats.totalOpenPositions}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Total positions to be filled</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-sm font-medium">Mandates Created</CardDescription>
              <div className="bg-purple-100 p-2 rounded-full">
                <Briefcase className="h-4 w-4 text-purple-600" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold text-primary">{stats.totalMandatesCreated}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Auto-generated from open positions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-sm font-medium">Headcount Entries</CardDescription>
              <div className="bg-orange-100 p-2 rounded-full">
                <ClipboardList className="h-4 w-4 text-orange-600" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold text-primary">{stats.totalAgreements}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Total job title agreements</p>
          </CardContent>
        </Card>
      </div>

      {/* Sites Table */}
      <Card>
        <CardHeader>
          <CardTitle>Your Assigned Sites</CardTitle>
          <CardDescription>Overview of all sites under your management</CardDescription>
        </CardHeader>
        <CardContent>
          {sites.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No sites assigned to you yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site Name</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Open Positions</TableHead>
                  <TableHead className="text-right">Agreements</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map((site) => (
                  <TableRow key={site.id}>
                    <TableCell>
                      <div className="font-medium">{site.site_name}</div>
                      {site.site_code && (
                        <div className="text-xs text-muted-foreground">{site.site_code}</div>
                      )}
                    </TableCell>
                    <TableCell>{site.client?.company_name || "-"}</TableCell>
                    <TableCell>
                      {site.location ? (
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {site.location}
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {site.contact_person && (
                          <div className="text-sm">{site.contact_person}</div>
                        )}
                        {site.contact_phone && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {site.contact_phone}
                          </div>
                        )}
                        {site.contact_email && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {site.contact_email}
                          </div>
                        )}
                        {!site.contact_person && !site.contact_phone && !site.contact_email && "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={site.openPositions > 0 ? "font-semibold text-primary" : ""}>
                        {site.openPositions}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{site.agreementCount}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate("/zonal-coordinator/headcount")}
                      >
                        View
                      </Button>
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
