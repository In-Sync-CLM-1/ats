import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { logError, getSupabaseErrorMessage, getCurrentUserId } from "@/lib/errorLogger";
import { ArrowLeft, Sparkles } from "lucide-react";
import { MultiResumeUploader, ParsedResumeData } from "@/components/MultiResumeUploader";
import { Badge } from "@/components/ui/badge";

type CandidateFormData = {
  first_name: string;
  last_name: string;
  phone?: string;
  phone_secondary?: string;
  email?: string;
  position_applied_for: string;
  application_date: string;
  current_status: string;
  source?: string;
  current_company?: string;
  designation?: string;
  total_experience_years?: number;
  current_ctc_lakhs?: number;
  expected_ctc_lakhs?: number;
  notice_period_days?: number;
  resume_url?: string;
  linkedin_url?: string;
  highest_qualification?: string;
  key_skills?: string;
  languages?: string;
  current_location?: string;
  preferred_location?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  interview_stage?: string;
  interviewer_names?: string;
  interview_feedback?: string;
  rating?: number;
  rejection_reason?: string;
  internal_notes?: string;
};

interface UploadedResume {
  url: string;
  fileName: string;
  parsedData?: ParsedResumeData;
  isPrimary: boolean;
}

export default function CandidateForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const isEditing = !!id;
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());
  const [uploadedResumes, setUploadedResumes] = useState<UploadedResume[]>([]);

  const form = useForm<CandidateFormData>({
    defaultValues: {
      first_name: "",
      last_name: "",
      phone: "",
      phone_secondary: "",
      email: "",
      position_applied_for: "",
      application_date: new Date().toISOString().split('T')[0],
      current_status: "sourcing_new_lead",
      source: "",
      current_company: "",
      designation: "",
      total_experience_years: undefined,
      current_ctc_lakhs: undefined,
      expected_ctc_lakhs: undefined,
      notice_period_days: undefined,
      resume_url: "",
      linkedin_url: "",
      highest_qualification: "",
      key_skills: "",
      languages: "",
      current_location: "",
      preferred_location: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
      country: "",
      interview_stage: "",
      interviewer_names: "",
      interview_feedback: "",
      rating: undefined,
      rejection_reason: "",
      internal_notes: "",
    },
  });

  const { data: candidate } = useQuery({
    queryKey: ["candidate", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("candidates")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: isEditing,
  });

  useEffect(() => {
    if (candidate) {
      form.reset(candidate);
    }
  }, [candidate, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: CandidateFormData) => {
      const userId = await getCurrentUserId(supabase);
      
      if (isEditing) {
        const { error } = await supabase
          .from("candidates")
          .update({ ...data, created_by: userId })
          .eq("id", id);
        if (error) throw error;
        return id;
      } else {
        const { data: insertedData, error } = await supabase
          .from("candidates")
          .insert([{ ...data, created_by: userId }])
          .select('id')
          .single();
        if (error) throw error;
        
        // Save uploaded resumes to the candidate_resumes table
        if (insertedData && uploadedResumes.length > 0) {
          const resumeRecords = uploadedResumes.map(resume => ({
            candidate_id: insertedData.id,
            file_url: resume.url,
            file_name: resume.fileName,
            parsed_data: JSON.parse(JSON.stringify(resume.parsedData || {})),
            is_primary: resume.isPrimary,
            uploaded_by: userId,
          }));
          
          const { error: resumeError } = await supabase
            .from("candidate_resumes")
            .insert(resumeRecords);
          
          if (resumeError) {
            console.error('Error saving resumes:', resumeError);
            // Don't throw - candidate was created, just log the error
          }
        }
        
        return insertedData.id;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      toast({ title: `Candidate ${isEditing ? "updated" : "created"} successfully` });
      navigate("/candidates");
    },
    onError: async (error: Error) => {
      logError(error, {
        component: "CandidateForm",
        operation: isEditing ? "UPDATE_DATA" : "CREATE_DATA",
        userId: await getCurrentUserId(supabase),
      });
      toast({
        title: `Error ${isEditing ? "updating" : "creating"} candidate`,
        description: getSupabaseErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CandidateFormData) => {
    saveMutation.mutate(data);
  };

  const handleResumeParsed = (data: any, resumeUrl: string) => {
    const fieldsToSet: (keyof CandidateFormData)[] = [
      'first_name', 'last_name', 'email', 'phone', 'phone_secondary',
      'current_company', 'designation', 'total_experience_years',
      'current_ctc_lakhs', 'expected_ctc_lakhs', 'notice_period_days',
      'key_skills', 'highest_qualification', 'languages',
      'current_location', 'preferred_location', 'linkedin_url', 'position_applied_for'
    ];
    
    const newAutoFilledFields = new Set<string>();
    
    fieldsToSet.forEach(field => {
      if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
        form.setValue(field, data[field]);
        newAutoFilledFields.add(field);
      }
    });
    
    // Always set the resume URL
    form.setValue('resume_url', resumeUrl);
    newAutoFilledFields.add('resume_url');
    
    setAutoFilledFields(newAutoFilledFields);
    
    toast({
      title: "Resume parsed successfully",
      description: `${newAutoFilledFields.size} fields auto-filled from resume`,
    });
  };

  const handleAllUploaded = (resumes: { url: string; fileName: string; parsedData?: ParsedResumeData; isPrimary: boolean }[]) => {
    setUploadedResumes(resumes);
  };

  const isAutoFilled = (fieldName: string) => autoFilledFields.has(fieldName);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/candidates')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-4xl font-bold">
            {isEditing ? "Edit Candidate" : "New Candidate"}
          </h1>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Resume Upload Section - Only show for new candidates */}
            {!isEditing && (
              <MultiResumeUploader 
                onPrimaryParsed={handleResumeParsed}
                onAllUploaded={handleAllUploaded}
                existingResumeUrl={form.getValues('resume_url')}
              />
            )}

            {/* Basic Information Section */}
            <div className="bg-card p-6 rounded-lg border space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Basic Information</h2>
                {autoFilledFields.size > 0 && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    AI Auto-filled
                  </Badge>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  rules={{ required: "First name is required", minLength: { value: 2, message: "Min 2 characters" } }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        First Name *
                        {isAutoFilled('first_name') && <Badge variant="outline" className="text-xs py-0">AI</Badge>}
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="John" className={isAutoFilled('first_name') ? 'border-primary/50 bg-primary/5' : ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="last_name"
                  rules={{ required: "Last name is required", minLength: { value: 2, message: "Min 2 characters" } }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        Last Name *
                        {isAutoFilled('last_name') && <Badge variant="outline" className="text-xs py-0">AI</Badge>}
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Doe" className={isAutoFilled('last_name') ? 'border-primary/50 bg-primary/5' : ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  rules={{ pattern: { value: /^\d{10}$/, message: "Must be 10 digits" } }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        Phone
                        {isAutoFilled('phone') && <Badge variant="outline" className="text-xs py-0">AI</Badge>}
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="9876543210" className={isAutoFilled('phone') ? 'border-primary/50 bg-primary/5' : ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone_secondary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Secondary Phone</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="9876543211" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  rules={{ pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Invalid email" } }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        Email
                        {isAutoFilled('email') && <Badge variant="outline" className="text-xs py-0">AI</Badge>}
                      </FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="john.doe@example.com" className={isAutoFilled('email') ? 'border-primary/50 bg-primary/5' : ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="linkedin_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        LinkedIn URL
                        {isAutoFilled('linkedin_url') && <Badge variant="outline" className="text-xs py-0">AI</Badge>}
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://linkedin.com/in/johndoe" className={isAutoFilled('linkedin_url') ? 'border-primary/50 bg-primary/5' : ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Application Details Section */}
            <div className="bg-card p-6 rounded-lg border space-y-4">
              <h2 className="text-xl font-semibold mb-4">Application Details</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="position_applied_for"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Position Applied For</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Software Engineer" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="application_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Application Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="current_status"
                  rules={{ required: "Status is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Status *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="sourcing_new_lead">Sourcing - New Lead</SelectItem>
                          <SelectItem value="sourcing_initial_screening_call">Sourcing - Initial Screening Call</SelectItem>
                          <SelectItem value="ats_assessment_screening_cleared">ATS Assessment - Screening Cleared</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select source" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                          <SelectItem value="Referral">Referral</SelectItem>
                          <SelectItem value="Job Portal">Job Portal</SelectItem>
                          <SelectItem value="Company Website">Company Website</SelectItem>
                          <SelectItem value="Walk-in">Walk-in</SelectItem>
                          <SelectItem value="Campus">Campus</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Experience & Compensation Section */}
            <div className="bg-card p-6 rounded-lg border space-y-4">
              <h2 className="text-xl font-semibold mb-4">Experience & Compensation</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="current_company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Company</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="TechCorp" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="designation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Designation</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Senior Developer" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="total_experience_years"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Experience (Years)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.5" placeholder="5.5" onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="current_ctc_lakhs"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current CTC (Lakhs)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" placeholder="12.00" onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expected_ctc_lakhs"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected CTC (Lakhs)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" placeholder="18.00" onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notice_period_days"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notice Period (Days)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" placeholder="60" onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Skills & Qualifications Section */}
            <div className="bg-card p-6 rounded-lg border space-y-4">
              <h2 className="text-xl font-semibold mb-4">Skills & Qualifications</h2>
              
              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={form.control}
                  name="highest_qualification"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Highest Qualification</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="B.Tech Computer Science" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="key_skills"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Key Skills</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="React, TypeScript, Node.js..." rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="languages"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Languages</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="English, Hindi" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="resume_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Resume URL</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://resume.com/john.pdf" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Location Section */}
            <div className="bg-card p-6 rounded-lg border space-y-4">
              <h2 className="text-xl font-semibold mb-4">Location Details</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="current_location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Location</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Bangalore" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="preferred_location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Location</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Mumbai, Bangalore" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Bangalore" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Karnataka" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pincode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pincode</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="560001" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="India" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Full Address</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Street address..." rows={2} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Additional Information Section */}
            <div className="bg-card p-6 rounded-lg border space-y-4">
              <h2 className="text-xl font-semibold mb-4">Additional Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="interview_stage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Interview Stage</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Technical Round 2" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="interviewer_names"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Interviewer Names</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="John Smith, Jane Doe" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="rating"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rating (1-5)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min="1" max="5" placeholder="4" onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="rejection_reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rejection Reason</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="If rejected..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="interview_feedback"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Interview Feedback</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Feedback from interviews..." rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="internal_notes"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Internal Notes</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Internal notes for recruiters..." rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/candidates")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : isEditing ? "Update Candidate" : "Create Candidate"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
