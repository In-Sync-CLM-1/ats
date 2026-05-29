import { useNavigate, useParams } from "react-router-dom";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TagsInput } from "@/components/forms/TagsInput";
import { LocationsInput } from "@/components/forms/LocationsInput";

const mandateSchema = z.object({
  job_title: z.string().min(1, "Job title is required"),
  client_id: z.string().uuid("Please select a client"),
  mandate_id: z.string().optional(),
  mandate_status: z.string().default("open"),
  priority_level: z.string().default("medium"),
  number_of_positions: z.coerce.number().min(1).default(1),
  mandate_received_date: z.string(),
  target_closure_date: z.string(),
  employment_type: z.string().default("permanent"),
  min_experience_years: z.coerce.number().min(0).default(0),
  max_experience_years: z.coerce.number().min(0).default(0),
  minimum_qualification: z.string().min(1, "Qualification is required"),
  mandatory_skills: z.array(z.string()).default([]),
  preferred_skills: z.array(z.string()).default([]),
  industry_experience: z.string().optional(),
  domain_knowledge: z.string().optional(),
  certifications_required: z.string().optional(),
  min_ctc_lakhs: z.coerce.number().min(0).default(0),
  max_ctc_lakhs: z.coerce.number().min(0).default(0),
  notice_period_acceptable: z.coerce.number().min(0).default(30),
  job_description: z.string().min(1, "Job description is required"),
  job_location: z.string().min(1, "Job location is required"),
  locations: z.any().default([]),
  work_mode: z.string().default("office"),
  shift_timings: z.string().optional(),
  reporting_to: z.string().optional(),
  team_size: z.coerce.number().optional(),
  key_responsibilities: z.string().optional(),
  variable_component: z.string().optional(),
  other_benefits: z.string().optional(),
  service_fee_percentage: z.coerce.number().min(0).default(0),
  replacement_period_days: z.coerce.number().min(0).default(90),
  interview_rounds: z.coerce.number().optional(),
  sourcing_strategy: z.string().optional(),
  client_turnaround_time: z.string().optional(),
  special_requirements: z.string().optional(),
  assigned_recruiter_id: z.string().uuid().optional(),
  secondary_recruiter_id: z.string().uuid().optional(),
  internal_notes: z.string().optional(),
  client_feedback: z.string().optional(),
});

type MandateFormData = z.infer<typeof mandateSchema>;

export default function MandateForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();

  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, company_name")
        .order("company_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: mandate, isLoading: mandateLoading } = useQuery({
    queryKey: ["mandate", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mandates")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<MandateFormData>({
    resolver: zodResolver(mandateSchema),
    defaultValues: {
      mandate_status: "open",
      priority_level: "medium",
      number_of_positions: 1,
      employment_type: "permanent",
      min_experience_years: 0,
      max_experience_years: 0,
      min_ctc_lakhs: 0,
      max_ctc_lakhs: 0,
      notice_period_acceptable: 30,
      work_mode: "office",
      service_fee_percentage: 0,
      replacement_period_days: 90,
      mandatory_skills: [],
      preferred_skills: [],
      locations: [],
      mandate_received_date: new Date().toISOString().split("T")[0],
      target_closure_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    },
  });

  // Load mandate data when editing
  useEffect(() => {
    if (mandate && id) {
      form.reset({
        job_title: mandate.job_title,
        client_id: mandate.client_id || undefined,
        mandate_id: mandate.mandate_id || undefined,
        mandate_status: mandate.mandate_status,
        priority_level: mandate.priority_level,
        number_of_positions: mandate.number_of_positions,
        mandate_received_date: mandate.mandate_received_date,
        target_closure_date: mandate.target_closure_date,
        employment_type: mandate.employment_type,
        min_experience_years: mandate.min_experience_years,
        max_experience_years: mandate.max_experience_years,
        minimum_qualification: mandate.minimum_qualification,
        mandatory_skills: mandate.mandatory_skills || [],
        preferred_skills: mandate.preferred_skills || [],
        industry_experience: mandate.industry_experience || undefined,
        domain_knowledge: mandate.domain_knowledge || undefined,
        certifications_required: mandate.certifications_required || undefined,
        min_ctc_lakhs: mandate.min_ctc_lakhs,
        max_ctc_lakhs: mandate.max_ctc_lakhs,
        notice_period_acceptable: mandate.notice_period_acceptable,
        job_description: mandate.job_description,
        job_location: mandate.job_location,
        locations: mandate.locations || [],
        work_mode: mandate.work_mode,
        shift_timings: mandate.shift_timings || undefined,
        reporting_to: mandate.reporting_to || undefined,
        team_size: mandate.team_size || undefined,
        key_responsibilities: mandate.key_responsibilities || undefined,
        variable_component: mandate.variable_component || undefined,
        other_benefits: mandate.other_benefits || undefined,
        service_fee_percentage: mandate.service_fee_percentage || 0,
        replacement_period_days: mandate.replacement_period_days,
        interview_rounds: mandate.interview_rounds || undefined,
        sourcing_strategy: mandate.sourcing_strategy || undefined,
        client_turnaround_time: mandate.client_turnaround_time || undefined,
        special_requirements: mandate.special_requirements || undefined,
        assigned_recruiter_id: mandate.assigned_recruiter_id || undefined,
        secondary_recruiter_id: mandate.secondary_recruiter_id || undefined,
        internal_notes: mandate.internal_notes || undefined,
        client_feedback: mandate.client_feedback || undefined,
      });
    }
  }, [mandate, id, form]);

  const mutation = useMutation({
    mutationFn: async (data: MandateFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const payload: any = {
        job_title: data.job_title,
        client_id: data.client_id,
        mandate_id: data.mandate_id || null,
        mandate_status: data.mandate_status,
        priority_level: data.priority_level,
        number_of_positions: data.number_of_positions,
        mandate_received_date: data.mandate_received_date,
        target_closure_date: data.target_closure_date,
        employment_type: data.employment_type,
        min_experience_years: data.min_experience_years,
        max_experience_years: data.max_experience_years,
        minimum_qualification: data.minimum_qualification,
        mandatory_skills: data.mandatory_skills || [],
        preferred_skills: data.preferred_skills || [],
        industry_experience: data.industry_experience || null,
        domain_knowledge: data.domain_knowledge || null,
        certifications_required: data.certifications_required || null,
        min_ctc_lakhs: data.min_ctc_lakhs,
        max_ctc_lakhs: data.max_ctc_lakhs,
        notice_period_acceptable: data.notice_period_acceptable,
        job_description: data.job_description,
        job_location: data.job_location,
        locations: data.locations || [],
        work_mode: data.work_mode,
        shift_timings: data.shift_timings || null,
        reporting_to: data.reporting_to || null,
        team_size: data.team_size || null,
        key_responsibilities: data.key_responsibilities || null,
        variable_component: data.variable_component || null,
        other_benefits: data.other_benefits || null,
        service_fee_percentage: data.service_fee_percentage,
        replacement_period_days: data.replacement_period_days,
        interview_rounds: data.interview_rounds || null,
        sourcing_strategy: data.sourcing_strategy || null,
        client_turnaround_time: data.client_turnaround_time || null,
        special_requirements: data.special_requirements || null,
        assigned_recruiter_id: data.assigned_recruiter_id || null,
        secondary_recruiter_id: data.secondary_recruiter_id || null,
        internal_notes: data.internal_notes || null,
        client_feedback: data.client_feedback || null,
        created_by: user?.id,
      };

      if (id) {
        const { error } = await supabase
          .from("mandates")
          .update(payload)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("mandates")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mandates"] });
      toast.success(id ? "Mandate updated successfully" : "Mandate created successfully");
      navigate("/mandates");
    },
    onError: (error) => {
      toast.error("Failed to save mandate: " + error.message);
    },
  });

  const onSubmit = (data: MandateFormData) => {
    mutation.mutate(data);
  };

  if (id && mandateLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/mandates")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {id ? "Edit Mandate" : "Create Mandate"}
          </h1>
          <p className="text-muted-foreground">
            {id ? "Update mandate details" : "Fill in the details to create a new mandate"}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="requirements">Requirements</TabsTrigger>
              <TabsTrigger value="job">Job Details</TabsTrigger>
              <TabsTrigger value="benefits">Benefits</TabsTrigger>
              <TabsTrigger value="process">Process</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
            </TabsList>

            <TabsContent value="basic">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="job_title"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Job Title <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Senior Software Engineer" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="client_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client <span className="text-destructive">*</span></FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select client" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {clientsLoading ? (
                                <SelectItem value="loading" disabled>Loading...</SelectItem>
                              ) : (
                                clients?.map((client) => (
                                  <SelectItem key={client.id} value={client.id}>
                                    {client.company_name}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="mandate_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mandate ID</FormLabel>
                          <FormControl>
                            <Input placeholder="Auto-generated" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="mandate_status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status <span className="text-destructive">*</span></FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="on_hold">On Hold</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="priority_level"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priority <span className="text-destructive">*</span></FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="number_of_positions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Positions <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input type="number" min="1" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="employment_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Employment Type <span className="text-destructive">*</span></FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="permanent">Permanent</SelectItem>
                              <SelectItem value="contract">Contract</SelectItem>
                              <SelectItem value="temporary">Temporary</SelectItem>
                              <SelectItem value="internship">Internship</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="mandate_received_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Received Date <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="target_closure_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Target Closure <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="requirements">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="min_experience_years"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Min Experience (Years) <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input type="number" min="0" step="0.5" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="max_experience_years"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Experience (Years) <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input type="number" min="0" step="0.5" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="minimum_qualification"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Minimum Qualification <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Bachelor's in Computer Science" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="mandatory_skills"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Mandatory Skills <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <TagsInput
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="Type skill and press Enter"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="preferred_skills"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Preferred Skills</FormLabel>
                          <FormControl>
                            <TagsInput
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="Type skill and press Enter"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="industry_experience"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Industry Experience</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 5 years in FinTech" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="domain_knowledge"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Domain Knowledge</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Payment systems, Banking" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="certifications_required"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Certifications Required</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., AWS Certified, PMP" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="min_ctc_lakhs"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Min CTC (Lakhs) <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input type="number" min="0" step="0.1" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="max_ctc_lakhs"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max CTC (Lakhs) <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input type="number" min="0" step="0.1" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="notice_period_acceptable"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Notice Period (Days) <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input type="number" min="0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="job">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <FormField
                    control={form.control}
                    name="job_description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job Description <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Textarea rows={6} placeholder="Detailed job description..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="job_location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Primary Location <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Mumbai, Maharashtra" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="work_mode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Work Mode <span className="text-destructive">*</span></FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="office">Office</SelectItem>
                              <SelectItem value="remote">Remote</SelectItem>
                              <SelectItem value="hybrid">Hybrid</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="locations"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Locations</FormLabel>
                        <FormControl>
                          <LocationsInput value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="shift_timings"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Shift Timings</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 9 AM - 6 PM" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="team_size"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Team Size</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="reporting_to"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Reporting To</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., VP Engineering" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="key_responsibilities"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Key Responsibilities</FormLabel>
                        <FormControl>
                          <Textarea rows={4} placeholder="List key responsibilities..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="benefits">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="service_fee_percentage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Service Fee (%) <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input type="number" min="0" step="0.1" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="replacement_period_days"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Replacement Period (Days) <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input type="number" min="0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="variable_component"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Variable Component</FormLabel>
                        <FormControl>
                          <Textarea rows={3} placeholder="Details about variable pay..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="other_benefits"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Other Benefits</FormLabel>
                        <FormControl>
                          <Textarea rows={3} placeholder="Health insurance, stock options, etc..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="process">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="interview_rounds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Interview Rounds</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="client_turnaround_time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client Turnaround Time</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 2-3 days" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="sourcing_strategy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sourcing Strategy</FormLabel>
                        <FormControl>
                          <Textarea rows={4} placeholder="Describe the sourcing strategy..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="special_requirements"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Special Requirements</FormLabel>
                        <FormControl>
                          <Textarea rows={4} placeholder="Any special requirements..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="team">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="assigned_recruiter_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assigned Recruiter</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select recruiter" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {profilesLoading ? (
                                <SelectItem value="loading" disabled>Loading...</SelectItem>
                              ) : (
                                profiles?.map((profile) => (
                                  <SelectItem key={profile.id} value={profile.id}>
                                    {profile.full_name}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="secondary_recruiter_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Secondary Recruiter</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select recruiter" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {profilesLoading ? (
                                <SelectItem value="loading" disabled>Loading...</SelectItem>
                              ) : (
                                profiles?.map((profile) => (
                                  <SelectItem key={profile.id} value={profile.id}>
                                    {profile.full_name}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="internal_notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Internal Notes</FormLabel>
                        <FormControl>
                          <Textarea rows={4} placeholder="Internal team notes..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="client_feedback"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client Feedback</FormLabel>
                        <FormControl>
                          <Textarea rows={4} placeholder="Feedback from client..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/mandates")}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {id ? "Update Mandate" : "Create Mandate"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
