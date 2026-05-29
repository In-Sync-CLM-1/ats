import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Plus, X } from "lucide-react";

interface ClientFormData {
  company_name: string;
  industry_sector: string;
  contact_name: string;
  contact_person_designation: string;
  email_id: string;
  contact_number: string;
  client_status: 'active' | 'inactive' | 'on_hold';
  registration_date: string;
  company_size_employees?: number;
  company_website?: string;
  company_type?: 'startup' | 'mnc' | 'sme' | 'enterprise';
  head_office_location?: string;
  branch_locations?: Array<{city: string; address: string}>;
  gst_number?: string;
  pan_number?: string;
  secondary_contact_person?: string;
  secondary_contact_email?: string;
  secondary_contact_phone?: string;
  hr_head_name?: string;
  hr_head_contact?: string;
  hiring_manager_name?: string;
  hiring_manager_contact?: string;
  finance_contact_name?: string;
  finance_contact_email?: string;
  finance_contact_phone?: string;
  payment_terms_days?: 30 | 45 | 60 | 90;
  service_fee_percentage?: number;
  billing_cycle?: 'monthly' | 'quarterly' | 'annual';
  credit_limit?: number;
  contract_start_date?: string;
  contract_end_date?: string;
  msa_agreement_status?: 'pending' | 'signed' | 'expired' | 'under_review';
  typical_hiring_volume_monthly?: number;
  typical_hiring_volume_yearly?: number;
  preferred_sourcing_channels?: string[];
  average_time_to_hire_days?: number;
  notice_period_accepted_days?: number;
  salary_range_min?: number;
  salary_range_max?: number;
  background_verification_required?: boolean;
  background_verification_details?: string;
  account_manager_id?: string;
  last_interaction_date?: string;
  internal_notes?: string;
}

export default function ClientForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [branchLocations, setBranchLocations] = useState<Array<{city: string; address: string}>>([]);
  const [sourcingChannels, setSourcingChannels] = useState<string[]>([]);
  const [newChannel, setNewChannel] = useState("");

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ClientFormData>({
    defaultValues: {
      client_status: 'active',
      registration_date: new Date().toISOString().split('T')[0],
      background_verification_required: false,
    }
  });

  const { data: existingClient, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from("clients").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: users } = useQuery({
    queryKey: ["users-for-account-manager"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (existingClient) {
      reset({
        company_name: existingClient.company_name,
        industry_sector: existingClient.industry_sector || '',
        contact_name: existingClient.contact_name,
        contact_person_designation: existingClient.contact_person_designation || '',
        email_id: existingClient.email_id || '',
        contact_number: existingClient.contact_number || '',
        client_status: (existingClient.client_status || 'active') as any,
        registration_date: existingClient.registration_date || new Date().toISOString().split('T')[0],
        company_size_employees: existingClient.company_size_employees || undefined,
        company_website: existingClient.company_website || '',
        company_type: existingClient.company_type as any,
        head_office_location: existingClient.head_office_location || '',
        gst_number: existingClient.gst_number || '',
        pan_number: existingClient.pan_number || '',
        payment_terms_days: existingClient.payment_terms_days as any,
        service_fee_percentage: existingClient.service_fee_percentage || undefined,
        billing_cycle: existingClient.billing_cycle as any,
        contract_start_date: existingClient.contract_start_date || '',
        contract_end_date: existingClient.contract_end_date || '',
        account_manager_id: existingClient.account_manager_id || '',
        internal_notes: existingClient.internal_notes || '',
      });
      if (existingClient.branch_locations) setBranchLocations(Array.isArray(existingClient.branch_locations) ? existingClient.branch_locations as any : []);
      if (existingClient.preferred_sourcing_channels) setSourcingChannels(Array.isArray(existingClient.preferred_sourcing_channels) ? existingClient.preferred_sourcing_channels as any : []);
    }
  }, [existingClient, reset]);

  const mutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      // Convert empty strings to null for integer/numeric fields
      const sanitizeNumber = (val: any) => (val === '' || val === undefined || val === null) ? null : Number(val);
      
      const payload = {
        ...data,
        branch_locations: branchLocations,
        preferred_sourcing_channels: sourcingChannels,
        company_size_employees: sanitizeNumber(data.company_size_employees),
        service_fee_percentage: sanitizeNumber(data.service_fee_percentage),
        credit_limit: sanitizeNumber(data.credit_limit),
        typical_hiring_volume_monthly: sanitizeNumber(data.typical_hiring_volume_monthly),
        typical_hiring_volume_yearly: sanitizeNumber(data.typical_hiring_volume_yearly),
        average_time_to_hire_days: sanitizeNumber(data.average_time_to_hire_days),
        notice_period_accepted_days: sanitizeNumber(data.notice_period_accepted_days),
        salary_range_min: sanitizeNumber(data.salary_range_min),
        salary_range_max: sanitizeNumber(data.salary_range_max),
        payment_terms_days: sanitizeNumber(data.payment_terms_days),
      };

      if (id) {
        const { data: result, error } = await supabase.from("clients").update(payload).eq("id", id).select().single();
        if (error) throw error;
        return result;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: result, error } = await supabase.from("clients").insert({ ...payload, created_by: user?.id }).select().single();
        if (error) throw error;
        return result;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success(id ? "Client updated successfully" : "Client created successfully");
      navigate("/clients");
    },
    onError: (error: any) => {
      if (error.code === '23505' && error.message.includes('contact_number')) {
        toast.error("This phone number is already registered to another client");
      } else {
        toast.error(error.message || "Failed to save client");
      }
    },
  });

  if (isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Button variant="ghost" onClick={() => navigate("/clients")} className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
      <h1 className="text-3xl font-bold mb-6">{id ? "Edit Client" : "Add New Client"}</h1>
      <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
        <Tabs defaultValue="basic">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="company">Company</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="commercial">Commercial</TabsTrigger>
            <TabsTrigger value="recruitment">Recruitment</TabsTrigger>
            <TabsTrigger value="admin">Admin</TabsTrigger>
          </TabsList>
          <TabsContent value="basic">
            <Card><CardHeader><CardTitle>Basic Information</CardTitle></CardHeader><CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Company Name *</Label><Input {...register("company_name", { required: true })} /></div>
                <div><Label>Industry *</Label><Input {...register("industry_sector", { required: true })} /></div>
                <div><Label>Contact Name *</Label><Input {...register("contact_name", { required: true })} /></div>
                <div><Label>Designation *</Label><Input {...register("contact_person_designation", { required: true })} /></div>
                <div><Label>Email *</Label><Input type="email" {...register("email_id", { required: true })} /></div>
                <div><Label>Phone * (Unique)</Label><Input {...register("contact_number", { required: true })} /></div>
                <div><Label>Status *</Label><Select value={watch("client_status")} onValueChange={(v) => setValue("client_status", v as any)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="on_hold">On Hold</SelectItem></SelectContent></Select></div>
                <div><Label>Registration Date *</Label><Input type="date" {...register("registration_date", { required: true })} /></div>
              </div>
            </CardContent></Card>
          </TabsContent>
          <TabsContent value="company"><Card><CardContent className="pt-6"><div className="grid grid-cols-2 gap-4"><div><Label>Company Size</Label><Input type="number" {...register("company_size_employees")} /></div><div><Label>Website</Label><Input {...register("company_website")} /></div></div></CardContent></Card></TabsContent>
          <TabsContent value="contacts"><Card><CardContent className="pt-6"><p className="text-muted-foreground">Additional contact fields...</p></CardContent></Card></TabsContent>
          <TabsContent value="commercial"><Card><CardContent className="pt-6"><p className="text-muted-foreground">Commercial terms...</p></CardContent></Card></TabsContent>
          <TabsContent value="recruitment"><Card><CardContent className="pt-6"><p className="text-muted-foreground">Recruitment details...</p></CardContent></Card></TabsContent>
          <TabsContent value="admin"><Card><CardContent className="pt-6"><div><Label>Internal Notes</Label><Textarea {...register("internal_notes")} /></div></CardContent></Card></TabsContent>
        </Tabs>
        <div className="mt-6 flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate("/clients")}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{id ? "Update" : "Create"}</Button>
        </div>
      </form>
    </div>
  );
}
