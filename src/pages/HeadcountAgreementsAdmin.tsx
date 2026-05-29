import { useState } from "react";
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
import { SiteSearchInput } from "@/components/zonal/SiteSearchInput";
import { JobTitleSearchInput } from "@/components/zonal/JobTitleSearchInput";
import { ClientSearchInput } from "@/components/zonal/ClientSearchInput";

interface HeadcountAgreement {
  id: string;
  site_id: string;
  job_title: string;
  agreed_headcount: number;
  available_headcount: number;
  open_positions: number;
  linked_mandate_id: string | null;
  site: {
    id: string;
    site_name: string;
    coordinator_id: string | null;
    client: {
      id: string;
      company_name: string;
    };
  };
}

interface FormData {
  client_id: string;
  site_id: string;
  job_title: string;
  agreed_headcount: number;
  coordinator_id: string;
}

const initialFormData: FormData = {
  client_id: "",
  site_id: "",
  job_title: "",
  agreed_headcount: 0,
  coordinator_id: "",
};

export default function HeadcountAgreementsAdmin() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAgreement, setEditingAgreement] = useState<HeadcountAgreement | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [agreementToDelete, setAgreementToDelete] = useState<HeadcountAgreement | null>(null);

  // Fetch zonal coordinators
  const { data: zonalCoordinators = [] } = useQuery({
    queryKey: ["zonal-coordinators"],
    queryFn: async () => {
      // First get user_ids with zonal_coordinator role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "zonal_coordinator");

      if (roleError) throw roleError;
      if (!roleData || roleData.length === 0) return [];

      const userIds = roleData.map((r) => r.user_id);

      // Then fetch profiles for those users
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      if (profileError) throw profileError;
      return profiles || [];
    },
  });

  // Fetch agreements
  const { data: agreements = [], isLoading } = useQuery({
    queryKey: ["headcount-agreements-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_headcount_agreements")
        .select(`
          id,
          site_id,
          job_title,
          agreed_headcount,
          available_headcount,
          open_positions,
          linked_mandate_id,
          site:sites!inner(
            id,
            site_name,
            coordinator_id,
            client:clients!inner(id, company_name)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((item: any) => ({
        ...item,
        site: {
          id: item.site.id,
          site_name: item.site.site_name,
          coordinator_id: item.site.coordinator_id,
          client: {
            id: item.site.client.id,
            company_name: item.site.client.company_name,
          },
        },
      }));
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (editingAgreement) {
        // Update agreement
        const { error } = await supabase
          .from("site_headcount_agreements")
          .update({
            site_id: data.site_id,
            job_title: data.job_title,
            agreed_headcount: data.agreed_headcount,
            last_updated_by: user?.id,
            last_updated_at: new Date().toISOString(),
          })
          .eq("id", editingAgreement.id);
        if (error) throw error;

        // Update site coordinator if changed
        if (data.coordinator_id) {
          const { error: siteError } = await supabase
            .from("sites")
            .update({ coordinator_id: data.coordinator_id })
            .eq("id", data.site_id);
          if (siteError) throw siteError;
        }
      } else {
        // Create agreement
        const { error } = await supabase
          .from("site_headcount_agreements")
          .insert({
            site_id: data.site_id,
            job_title: data.job_title,
            agreed_headcount: data.agreed_headcount,
            last_updated_by: user?.id,
          });
        if (error) throw error;

        // Update site coordinator if specified
        if (data.coordinator_id) {
          const { error: siteError } = await supabase
            .from("sites")
            .update({ coordinator_id: data.coordinator_id })
            .eq("id", data.site_id);
          if (siteError) throw siteError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["headcount-agreements-admin"] });
      toast.success(editingAgreement ? "Agreement updated successfully" : "Agreement created successfully");
      handleCloseDialog();
    },
    onError: (error: any) => {
      console.error("Error saving agreement:", error);
      toast.error(error.message || "Failed to save agreement");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (agreementId: string) => {
      const { error } = await supabase
        .from("site_headcount_agreements")
        .delete()
        .eq("id", agreementId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["headcount-agreements-admin"] });
      toast.success("Agreement deleted successfully");
      setDeleteDialogOpen(false);
      setAgreementToDelete(null);
    },
    onError: (error: any) => {
      console.error("Error deleting agreement:", error);
      toast.error(error.message || "Failed to delete agreement");
    },
  });

  const handleOpenDialog = (agreement?: HeadcountAgreement) => {
    if (agreement) {
      setEditingAgreement(agreement);
      setFormData({
        client_id: agreement.site.client.id,
        site_id: agreement.site_id,
        job_title: agreement.job_title,
        agreed_headcount: agreement.agreed_headcount,
        coordinator_id: agreement.site.coordinator_id || "",
      });
    } else {
      setEditingAgreement(null);
      setFormData(initialFormData);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingAgreement(null);
    setFormData(initialFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.site_id || !formData.job_title) {
      toast.error("Please fill in all required fields");
      return;
    }
    saveMutation.mutate(formData);
  };

  const filteredAgreements = agreements.filter((agreement) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      agreement.site.site_name.toLowerCase().includes(search) ||
      agreement.site.client.company_name.toLowerCase().includes(search) ||
      agreement.job_title.toLowerCase().includes(search)
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
          <h1 className="text-3xl font-bold text-foreground">Headcount Agreements</h1>
          <p className="text-muted-foreground mt-1">
            Manage agreed headcount per site and job title
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Agreement
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Agreements</CardTitle>
              <CardDescription>{filteredAgreements.length} entries found</CardDescription>
            </div>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAgreements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No headcount agreements found. Create your first agreement to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Site</th>
                    <th className="text-left py-3 px-4 font-medium">Client</th>
                    <th className="text-left py-3 px-4 font-medium">Job Title</th>
                    <th className="text-center py-3 px-4 font-medium">Agreed HC</th>
                    <th className="text-center py-3 px-4 font-medium">Available HC</th>
                    <th className="text-center py-3 px-4 font-medium">Open Positions</th>
                    <th className="text-center py-3 px-4 font-medium">Mandate</th>
                    <th className="text-center py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAgreements.map((agreement) => (
                    <tr key={agreement.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 font-medium">{agreement.site.site_name}</td>
                      <td className="py-3 px-4">{agreement.site.client.company_name}</td>
                      <td className="py-3 px-4">{agreement.job_title}</td>
                      <td className="py-3 px-4 text-center">{agreement.agreed_headcount}</td>
                      <td className="py-3 px-4 text-center">{agreement.available_headcount}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={agreement.open_positions > 0 ? "destructive" : "secondary"}>
                          {agreement.open_positions}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {agreement.linked_mandate_id ? (
                          <Badge variant="default">Created</Badge>
                        ) : (
                          <Badge variant="outline">-</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenDialog(agreement)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive"
                            onClick={() => {
                              setAgreementToDelete(agreement);
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAgreement ? "Edit Agreement" : "Create Agreement"}</DialogTitle>
            <DialogDescription>
              {editingAgreement ? "Update headcount agreement" : "Add a new headcount agreement for a site"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Client *</Label>
                <ClientSearchInput
                  value={formData.client_id}
                  onChange={(clientId) => setFormData({ ...formData, client_id: clientId || "", site_id: "" })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Site *</Label>
                <SiteSearchInput
                  value={formData.site_id}
                  onChange={(siteId) => setFormData({ ...formData, site_id: siteId || "" })}
                  clientId={formData.client_id}
                  disabled={!formData.client_id}
                  isAdmin
                />
              </div>
              <div className="grid gap-2">
                <Label>Job Title *</Label>
                <JobTitleSearchInput
                  value={formData.job_title}
                  onChange={(title) => setFormData({ ...formData, job_title: title || "" })}
                  allowCustom
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="agreed_headcount">Agreed Headcount *</Label>
                <Input
                  id="agreed_headcount"
                  type="number"
                  min={0}
                  value={formData.agreed_headcount}
                  onChange={(e) => setFormData({ ...formData, agreed_headcount: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Zonal Coordinator</Label>
                <Select
                  value={formData.coordinator_id}
                  onValueChange={(value) => setFormData({ ...formData, coordinator_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select coordinator" />
                  </SelectTrigger>
                  <SelectContent>
                    {zonalCoordinators.map((coordinator) => (
                      <SelectItem key={coordinator.id} value={coordinator.id}>
                        {coordinator.full_name || coordinator.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <LoadingSpinner className="h-4 w-4 mr-2" /> : null}
                {editingAgreement ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => agreementToDelete && deleteMutation.mutate(agreementToDelete.id)}
        title="Delete Agreement"
        description={`Are you sure you want to delete this headcount agreement for "${agreementToDelete?.job_title}" at "${agreementToDelete?.site.site_name}"?`}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
