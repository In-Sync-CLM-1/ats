import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { Search, Save, Check, X, Users, Pencil } from "lucide-react";
import { toast } from "sonner";
import { SiteSearchInput } from "@/components/zonal/SiteSearchInput";
import { JobTitleSearchInput } from "@/components/zonal/JobTitleSearchInput";

interface HeadcountAgreement {
  id: string;
  site_id: string;
  job_title: string;
  agreed_headcount: number;
  required_male: number;
  required_female: number;
  linked_mandate_id: string | null;
  last_updated_at: string;
  site: {
    id: string;
    site_name: string;
    location: string | null;
    client: {
      id: string;
      company_name: string;
    };
  };
}

interface EditValues {
  required_male: number;
  required_female: number;
}

export default function HeadcountManagement() {
  const [agreements, setAgreements] = useState<HeadcountAgreement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<EditValues>({ required_male: 0, required_female: 0 });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedJobTitle, setSelectedJobTitle] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchAgreements = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get sites where this user is the coordinator
      const { data: assignedSites } = await supabase
        .from("sites")
        .select("id")
        .eq("coordinator_id", user.id);

      const siteIds = assignedSites?.map(s => s.id) || [];

      if (siteIds.length === 0) {
        setAgreements([]);
        setIsLoading(false);
        return;
      }

      let query = supabase
        .from("site_headcount_agreements")
        .select(`
          id,
          site_id,
          job_title,
          agreed_headcount,
          required_male,
          required_female,
          linked_mandate_id,
          last_updated_at,
          site:sites!inner(
            id,
            site_name,
            location,
            client:clients!inner(
              id,
              company_name
            )
          )
        `)
        .in("site_id", siteIds)
        .order("last_updated_at", { ascending: false });

      if (selectedSiteId) {
        query = query.eq("site_id", selectedSiteId);
      }

      if (selectedJobTitle) {
        query = query.ilike("job_title", `%${selectedJobTitle}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform the data to match our interface
      const transformedData = (data || []).map((item: any) => ({
        ...item,
        required_male: item.required_male || 0,
        required_female: item.required_female || 0,
        site: {
          id: item.site.id,
          site_name: item.site.site_name,
          location: item.site.location,
          client: {
            id: item.site.client.id,
            company_name: item.site.client.company_name,
          },
        },
      }));

      setAgreements(transformedData);
    } catch (error) {
      console.error("Error fetching agreements:", error);
      toast.error("Failed to load headcount data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAgreements();
  }, [selectedSiteId, selectedJobTitle]);

  const handleEdit = (agreement: HeadcountAgreement) => {
    setEditingId(agreement.id);
    setEditValues({
      required_male: agreement.required_male,
      required_female: agreement.required_female,
    });
  };

  const handleSave = async (agreementId: string) => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Find the current agreement to get previous values and site info
      const agreement = agreements.find(a => a.id === agreementId);
      if (!agreement) throw new Error("Agreement not found");

      const previousTotal = (agreement.required_male || 0) + (agreement.required_female || 0);
      const newTotal = editValues.required_male + editValues.required_female;

      let mandateId = agreement.linked_mandate_id;
      let successMessage = "Requirements updated";

      // CASE 1: No mandate exists yet
      if (!agreement.linked_mandate_id) {
        if (newTotal > 0) {
          // Create a new mandate
          const { data: newMandate, error: mandateError } = await supabase
            .from("mandates")
            .insert({
              job_title: agreement.job_title,
              job_description: `Headcount requirement for ${agreement.job_title} at ${agreement.site.site_name}`,
              job_location: agreement.site.location || "",
              number_of_positions: newTotal,
              client_id: agreement.site.client.id,
              created_by: user.id,
              mandate_status: "open",
              employment_type: "permanent",
              mandatory_skills: [],
              internal_notes: `Male: ${editValues.required_male}, Female: ${editValues.required_female} | Site: ${agreement.site.site_name} | Created from headcount requirement`,
              minimum_qualification: "",
              min_experience_years: 0,
              max_experience_years: 10,
              min_ctc_lakhs: 0,
              max_ctc_lakhs: 0,
              notice_period_acceptable: 30,
              replacement_period_days: 90,
              target_closure_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            })
            .select("id")
            .single();

          if (mandateError) throw mandateError;
          mandateId = newMandate.id;
          successMessage = "Requirements saved and mandate created successfully";
        }
      }
      // CASE 2: Mandate exists and newTotal > 0 (update positions)
      else if (newTotal > 0) {
        const { error: updateMandateError } = await supabase
          .from("mandates")
          .update({
            number_of_positions: newTotal,
            internal_notes: `Male: ${editValues.required_male}, Female: ${editValues.required_female} | Site: ${agreement.site.site_name} | Updated from headcount requirement`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", agreement.linked_mandate_id);

        if (updateMandateError) throw updateMandateError;
        successMessage = "Requirements updated and mandate positions adjusted";
      }
      // CASE 3: Mandate exists and newTotal = 0 (close the mandate)
      else {
        const { error: closeMandateError } = await supabase
          .from("mandates")
          .update({
            mandate_status: "closed",
            closed_date: new Date().toISOString().split('T')[0],
            closure_reason: "Headcount requirement set to zero",
            updated_at: new Date().toISOString(),
          })
          .eq("id", agreement.linked_mandate_id);

        if (closeMandateError) throw closeMandateError;
        successMessage = "Requirements cleared and mandate closed";
      }

      // Update the agreement
      const { error: agreementError } = await supabase
        .from("site_headcount_agreements")
        .update({
          required_male: editValues.required_male,
          required_female: editValues.required_female,
          linked_mandate_id: mandateId,
          last_updated_by: user.id,
          last_updated_at: new Date().toISOString(),
        })
        .eq("id", agreementId);

      if (agreementError) throw agreementError;

      toast.success(successMessage);
      setEditingId(null);
      fetchAgreements();
    } catch (error) {
      console.error("Error updating requirements:", error);
      toast.error("Failed to update requirements");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValues({ required_male: 0, required_female: 0 });
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Headcount Requirements</h1>
        <p className="text-muted-foreground mt-1">
          Fill requirements for your assigned sites with male/female differentiation
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter by site or job title</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search sites, clients, job titles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <SiteSearchInput
              value={selectedSiteId}
              onChange={setSelectedSiteId}
            />
            <JobTitleSearchInput
              value={selectedJobTitle}
              onChange={setSelectedJobTitle}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Headcount Agreements
          </CardTitle>
          <CardDescription>
            {filteredAgreements.length} entries found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredAgreements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No headcount agreements found for your assigned sites.
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
                    <th className="text-center py-3 px-4 font-medium">
                      <div className="flex flex-col items-center">
                        <span>Required</span>
                        <span className="text-xs text-blue-600">(Male)</span>
                      </div>
                    </th>
                    <th className="text-center py-3 px-4 font-medium">
                      <div className="flex flex-col items-center">
                        <span>Required</span>
                        <span className="text-xs text-pink-600">(Female)</span>
                      </div>
                    </th>
                    <th className="text-center py-3 px-4 font-medium">Total Required</th>
                    <th className="text-center py-3 px-4 font-medium">Status</th>
                    <th className="text-center py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAgreements.map((agreement) => {
                    const totalRequired = agreement.required_male + agreement.required_female;
                    const isEditing = editingId === agreement.id;
                    
                    return (
                      <tr key={agreement.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">
                          <div className="font-medium">{agreement.site.site_name}</div>
                          {agreement.site.location && (
                            <div className="text-sm text-muted-foreground">
                              {agreement.site.location}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">{agreement.site.client.company_name}</td>
                        <td className="py-3 px-4">{agreement.job_title}</td>
                        <td className="py-3 px-4 text-center font-medium">
                          {agreement.agreed_headcount}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isEditing ? (
                            <Input
                              type="number"
                              min={0}
                              value={editValues.required_male}
                              onChange={(e) => setEditValues(prev => ({
                                ...prev,
                                required_male: parseInt(e.target.value) || 0
                              }))}
                              className="w-16 mx-auto text-center"
                            />
                          ) : (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              {agreement.required_male}
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isEditing ? (
                            <Input
                              type="number"
                              min={0}
                              value={editValues.required_female}
                              onChange={(e) => setEditValues(prev => ({
                                ...prev,
                                required_female: parseInt(e.target.value) || 0
                              }))}
                              className="w-16 mx-auto text-center"
                            />
                          ) : (
                            <Badge variant="outline" className="bg-pink-50 text-pink-700 border-pink-200">
                              {agreement.required_female}
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant={totalRequired > 0 ? "default" : "secondary"}>
                            {totalRequired}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {agreement.linked_mandate_id ? (
                            <Badge variant="default">Mandate Created</Badge>
                          ) : totalRequired > 0 ? (
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                              Pending
                            </Badge>
                          ) : (
                            <Badge variant="secondary">No Requirement</Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isEditing ? (
                            <div className="flex justify-center gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSave(agreement.id)}
                                disabled={isSaving}
                              >
                                {isSaving ? (
                                  <LoadingSpinner className="h-4 w-4" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancel}
                                disabled={isSaving}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(agreement)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
