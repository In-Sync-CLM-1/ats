import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { INDIAN_STATES, getCitiesByStateCode, generateClientCode } from "@/lib/indianLocations";

interface Site {
  id: string;
  client_id: string;
  site_name: string;
  site_code: string | null;
  location: string | null;
  address: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  is_active: boolean;
  coordinator_id: string | null;
  client: {
    id: string;
    company_name: string;
  };
  coordinator: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
}

interface SiteFormData {
  client_id: string;
  site_name: string;
  site_code: string;
  state: string;
  city: string;
  coordinator_id: string;
}

interface ZonalCoordinator {
  id: string;
  full_name: string | null;
  email: string;
}

const initialFormData: SiteFormData = {
  client_id: "",
  site_name: "",
  site_code: "",
  state: "",
  city: "",
  coordinator_id: "",
};

export default function SitesAdmin() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [formData, setFormData] = useState<SiteFormData>(initialFormData);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [siteToDelete, setSiteToDelete] = useState<Site | null>(null);

  // Fetch clients for dropdown
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-dropdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, company_name")
        .eq("client_status", "active")
        .order("company_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch zonal coordinators for dropdown
  const { data: zonalCoordinators = [] } = useQuery({
    queryKey: ["zonal-coordinators"],
    queryFn: async () => {
      // Get users with zonal_coordinator role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "zonal_coordinator");

      if (roleError) throw roleError;

      const userIds = roleData?.map((r) => r.user_id) || [];

      if (userIds.length === 0) return [];

      const { data: usersData, error: usersError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds)
        .order("full_name");

      if (usersError) throw usersError;
      return usersData as ZonalCoordinator[];
    },
  });

  // Fetch sites
  const { data: sites = [], isLoading } = useQuery({
    queryKey: ["sites-admin"],
    queryFn: async () => {
      const { data: sitesData, error: sitesError } = await supabase
        .from("sites")
        .select(`
          id,
          client_id,
          site_name,
          site_code,
          location,
          address,
          contact_person,
          contact_phone,
          contact_email,
          is_active,
          coordinator_id,
          client:clients!inner(id, company_name)
        `)
        .order("site_name");

      if (sitesError) throw sitesError;

      // Get coordinator profiles
      const coordinatorIds = sitesData
        ?.map((s: any) => s.coordinator_id)
        .filter(Boolean) || [];

      let coordinatorMap: Record<string, { id: string; full_name: string | null; email: string }> = {};

      if (coordinatorIds.length > 0) {
        const { data: coordinators } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", coordinatorIds);

        coordinatorMap = (coordinators || []).reduce((acc, c) => {
          acc[c.id] = c;
          return acc;
        }, {} as Record<string, { id: string; full_name: string | null; email: string }>);
      }

      return (sitesData || []).map((site: any) => ({
        ...site,
        client: {
          id: site.client.id,
          company_name: site.client.company_name,
        },
        coordinator: site.coordinator_id ? coordinatorMap[site.coordinator_id] || null : null,
      }));
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: SiteFormData & { location: string }) => {
      if (editingSite) {
        const { error } = await supabase
          .from("sites")
          .update({
            client_id: data.client_id,
            site_name: data.site_name,
            site_code: data.site_code || null,
            location: data.location || null,
            coordinator_id: data.coordinator_id || null,
          })
          .eq("id", editingSite.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("sites")
          .insert({
            client_id: data.client_id,
            site_name: data.site_name,
            site_code: data.site_code || null,
            location: data.location || null,
            coordinator_id: data.coordinator_id || null,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites-admin"] });
      toast.success(editingSite ? "Site updated successfully" : "Site created successfully");
      handleCloseDialog();
    },
    onError: (error: any) => {
      console.error("Error saving site:", error);
      toast.error(error.message || "Failed to save site");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (siteId: string) => {
      const { error } = await supabase
        .from("sites")
        .delete()
        .eq("id", siteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites-admin"] });
      toast.success("Site deleted successfully");
      setDeleteDialogOpen(false);
      setSiteToDelete(null);
    },
    onError: (error: any) => {
      console.error("Error deleting site:", error);
      toast.error(error.message || "Failed to delete site");
    },
  });

  // Parse location into state and city for editing
  const parseLocationToStateCity = (location: string | null): { state: string; city: string } => {
    if (!location) return { state: "", city: "" };
    const parts = location.split(",").map(p => p.trim());
    if (parts.length >= 2) {
      const cityName = parts[0];
      const stateName = parts[1];
      // Find state by name
      const stateData = INDIAN_STATES.find(s => s.name === stateName);
      if (stateData) {
        const cityData = stateData.cities.find(c => c.name === cityName);
        return { state: stateData.code, city: cityData?.code || "" };
      }
    }
    return { state: "", city: "" };
  };

  const handleOpenDialog = (site?: Site) => {
    if (site) {
      setEditingSite(site);
      const { state, city } = parseLocationToStateCity(site.location);
      setFormData({
        client_id: site.client_id,
        site_name: site.site_name,
        site_code: site.site_code || "",
        state,
        city,
        coordinator_id: site.coordinator_id || "",
      });
    } else {
      setEditingSite(null);
      setFormData(initialFormData);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingSite(null);
    setFormData(initialFormData);
  };

  // Get cities based on selected state
  const availableCities = useMemo(() => {
    return getCitiesByStateCode(formData.state);
  }, [formData.state]);

  // Auto-generate site code when client, state, and city are selected
  useEffect(() => {
    if (formData.client_id && formData.state && formData.city && !editingSite) {
      const selectedClient = clients.find(c => c.id === formData.client_id);
      if (selectedClient) {
        const clientCode = generateClientCode(selectedClient.company_name);
        
        // Count existing sites for same client/state/city to get sequence
        const existingSites = sites.filter(s => {
          const { state, city } = parseLocationToStateCity(s.location);
          return s.client_id === formData.client_id && state === formData.state && city === formData.city;
        });
        
        const sequence = String(existingSites.length + 1).padStart(3, "0");
        const newSiteCode = `${clientCode}-${formData.state}-${formData.city}-${sequence}`;
        
        setFormData(prev => ({ ...prev, site_code: newSiteCode }));
      }
    }
  }, [formData.client_id, formData.state, formData.city, clients, sites, editingSite]);

  // Reset city when state changes
  useEffect(() => {
    if (formData.state) {
      const citiesForState = getCitiesByStateCode(formData.state);
      const cityStillValid = citiesForState.some(c => c.code === formData.city);
      if (!cityStillValid && formData.city) {
        setFormData(prev => ({ ...prev, city: "" }));
      }
    }
  }, [formData.state]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client_id || !formData.site_name || !formData.state || !formData.city) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    // Build location from state and city
    const stateData = INDIAN_STATES.find(s => s.code === formData.state);
    const cityData = stateData?.cities.find(c => c.code === formData.city);
    const location = cityData && stateData ? `${cityData.name}, ${stateData.name}` : "";
    saveMutation.mutate({ ...formData, location });
  };

  const filteredSites = sites.filter((site) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      site.site_name.toLowerCase().includes(search) ||
      site.client.company_name.toLowerCase().includes(search) ||
      site.site_code?.toLowerCase().includes(search) ||
      site.location?.toLowerCase().includes(search) ||
      site.coordinator?.full_name?.toLowerCase().includes(search) ||
      site.coordinator?.email.toLowerCase().includes(search)
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="px-8 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sites Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage client sites and assign coordinators
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Site
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sites</CardTitle>
              <CardDescription>{filteredSites.length} sites found</CardDescription>
            </div>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search sites..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredSites.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No sites found. Create your first site to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Site Name</th>
                    <th className="text-left py-3 px-4 font-medium">Client</th>
                    <th className="text-left py-3 px-4 font-medium">Site Code</th>
                    <th className="text-left py-3 px-4 font-medium">Location</th>
                    <th className="text-left py-3 px-4 font-medium">Coordinator</th>
                    <th className="text-center py-3 px-4 font-medium">Status</th>
                    <th className="text-center py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSites.map((site) => (
                    <tr key={site.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 font-medium">{site.site_name}</td>
                      <td className="py-3 px-4">{site.client.company_name}</td>
                      <td className="py-3 px-4">{site.site_code || "-"}</td>
                      <td className="py-3 px-4">{site.location || "-"}</td>
                      <td className="py-3 px-4">
                        {site.coordinator ? (
                          <div>
                            <div className="font-medium">{site.coordinator.full_name || "No name"}</div>
                            <div className="text-sm text-muted-foreground">{site.coordinator.email}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not assigned</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={site.is_active ? "default" : "secondary"}>
                          {site.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenDialog(site)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive"
                            onClick={() => {
                              setSiteToDelete(site);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingSite ? "Edit Site" : "Create Site"}</DialogTitle>
            <DialogDescription>
              {editingSite ? "Update site details" : "Add a new site to a client"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="client_id">Client *</Label>
                <Select
                  value={formData.client_id}
                  onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="site_name">Site Name *</Label>
                <Input
                  id="site_name"
                  value={formData.site_name}
                  onChange={(e) => setFormData({ ...formData, site_name: e.target.value })}
                  placeholder="Enter site name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="state">State *</Label>
                  <Select
                    value={formData.state}
                    onValueChange={(value) => setFormData({ ...formData, state: value, city: "" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDIAN_STATES.map((state) => (
                        <SelectItem key={state.code} value={state.code}>
                          {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="city">City *</Label>
                  <Select
                    value={formData.city}
                    onValueChange={(value) => setFormData({ ...formData, city: value })}
                    disabled={!formData.state}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formData.state ? "Select city" : "Select state first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCities.map((city) => (
                        <SelectItem key={city.code} value={city.code}>
                          {city.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="coordinator_id">Zonal Coordinator</Label>
                <Select
                  value={formData.coordinator_id || "none"}
                  onValueChange={(value) => setFormData({ ...formData, coordinator_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a coordinator (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {zonalCoordinators.map((coordinator) => (
                      <SelectItem key={coordinator.id} value={coordinator.id}>
                        {coordinator.full_name || coordinator.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {zonalCoordinators.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No users with 'zonal_coordinator' role found. Assign the role to users in the Users page first.
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="site_code">Site Code (Auto-generated)</Label>
                <Input
                  id="site_code"
                  value={formData.site_code}
                  readOnly
                  className="bg-muted cursor-not-allowed"
                  placeholder="Will be auto-generated"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <LoadingSpinner className="h-4 w-4 mr-2" /> : null}
                {editingSite ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => siteToDelete && deleteMutation.mutate(siteToDelete.id)}
        title="Delete Site"
        description={`Are you sure you want to delete "${siteToDelete?.site_name}"? This action cannot be undone and will also delete all headcount agreements for this site.`}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
