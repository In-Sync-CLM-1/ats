import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OfferCard } from "@/components/OfferCard";
import { CallHistory } from "@/components/CallHistory";
import { CandidateScoreCard } from "@/components/CandidateScoreCard";
import { AIScreeningButton } from "@/components/AIScreeningButton";
import { ExotelCallDialog } from "@/components/ExotelCallDialog";
import { WhatsAppDialog } from "@/components/WhatsAppDialog";
import { EmailComposeDialog } from "@/components/EmailComposeDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Mail, MapPin, Briefcase, GraduationCap, Calendar, FileText, ExternalLink, ArrowLeft, Star, Download, MessageCircle, ClipboardCheck, Copy } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const DEFAULT_STAGES = ["Applied", "Screening", "Interview", "Offer", "Selected", "Joined"];

const STAGE_BADGE_CLASS: Record<string, string> = {
  Applied: "bg-slate-100 text-slate-700 border-slate-300",
  Screening: "bg-amber-100 text-amber-800 border-amber-300",
  Shortlisted: "bg-amber-100 text-amber-800 border-amber-300",
  Interview: "bg-blue-100 text-blue-800 border-blue-300",
  Offer: "bg-purple-100 text-purple-800 border-purple-300",
  Selected: "bg-green-100 text-green-800 border-green-300",
  Joined: "bg-emerald-100 text-emerald-800 border-emerald-300",
};

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrg } = useOrg();
  const queryClient = useQueryClient();
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  const { data: candidate, isLoading } = useQuery({
    queryKey: ['candidate-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Pipeline stages for the stage-move control (org-configured, sensible fallback)
  const { data: pipelineStages } = useQuery({
    queryKey: ["pipeline-stages", currentOrg?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pipeline_stages")
        .select("name, stage_order")
        .eq("stage_type", "candidate")
        .eq("is_active", true)
        .order("stage_order");
      return data || [];
    },
    enabled: !!currentOrg?.id,
  });
  const stageNames = pipelineStages?.length ? pipelineStages.map((s) => s.name) : DEFAULT_STAGES;

  const moveStage = async (stage: string) => {
    const { error } = await supabase
      .from("candidates")
      .update({ interview_stage: stage })
      .eq("id", id!);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["candidate-detail", id] });
    toast.success(`Stage updated to ${stage}`);
  };

  // Fetch onboarding submission for this candidate
  const { data: onboardingSubmission } = useQuery({
    queryKey: ["onboarding-submission-candidate", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("onboarding_submissions")
        .select("id, status, created_at, onboarding_forms(slug)")
        .eq("candidate_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  // Fetch active onboarding forms for this org (for link generation)
  const { data: activeForm } = useQuery({
    queryKey: ["active-onboarding-form", currentOrg?.id],
    queryFn: async () => {
      const q = supabase.from("onboarding_forms").select("id, slug, title").eq("is_active", true).limit(1);
      if (currentOrg?.id) q.eq("org_id", currentOrg.id);
      const { data } = await q.maybeSingle();
      return data;
    },
    enabled: !!currentOrg?.id,
  });

  // Fetch all resumes for this candidate
  const { data: resumes = [] } = useQuery({
    queryKey: ['candidate-resumes', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidate_resumes')
        .select('*')
        .eq('candidate_id', id)
        .order('is_primary', { ascending: false })
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Candidate not found</p>
        <Button variant="link" onClick={() => navigate('/candidates')}>
          Back to Candidates
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/candidates')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {candidate.first_name} {candidate.last_name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge
                variant="outline"
                className={cn("font-medium", STAGE_BADGE_CLASS[candidate.interview_stage ?? ""] || "")}
              >
                {candidate.interview_stage || candidate.current_status.replace('_', ' ')}
              </Badge>
              <Select value={candidate.interview_stage ?? undefined} onValueChange={moveStage}>
                <SelectTrigger className="h-7 w-[150px] text-xs" aria-label="Move stage">
                  <SelectValue placeholder="Move stage" />
                </SelectTrigger>
                <SelectContent>
                  {stageNames.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {candidate.phone && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setCallDialogOpen(true)}
            >
              <Phone className="h-4 w-4 text-green-600" />
              Call
            </Button>
          )}
          {candidate.phone && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setWhatsappDialogOpen(true)}
            >
              <MessageCircle className="h-4 w-4 text-green-500" />
              WhatsApp
            </Button>
          )}
          {candidate.email && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setEmailDialogOpen(true)}
            >
              <Mail className="h-4 w-4 text-blue-500" />
              Email
            </Button>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {candidate.phone && (
        <ExotelCallDialog
          open={callDialogOpen}
          onOpenChange={setCallDialogOpen}
          candidateData={{
            id: candidate.id,
            first_name: candidate.first_name,
            last_name: candidate.last_name,
            phone: candidate.phone,
            email: candidate.email,
            designation: candidate.position_applied_for,
            current_company: candidate.current_company,
            position_applied_for: candidate.position_applied_for,
          }}
        />
      )}
      {candidate.phone && (
        <WhatsAppDialog
          open={whatsappDialogOpen}
          onOpenChange={setWhatsappDialogOpen}
          candidateData={{
            id: candidate.id,
            first_name: candidate.first_name,
            last_name: candidate.last_name,
            phone: candidate.phone,
            email: candidate.email,
            designation: candidate.position_applied_for,
            current_company: candidate.current_company,
            position_applied_for: candidate.position_applied_for,
          }}
        />
      )}
      {candidate.email && (
        <EmailComposeDialog
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          recipientData={{
            id: candidate.id,
            first_name: candidate.first_name,
            last_name: candidate.last_name,
            email: candidate.email,
            phone: candidate.phone,
            phone_secondary: candidate.phone_secondary,
            position_applied_for: candidate.position_applied_for,
            current_company: candidate.current_company,
            current_status: candidate.current_status,
            interview_stage: candidate.interview_stage,
            total_experience_years: candidate.total_experience_years,
            current_ctc_lakhs: candidate.current_ctc_lakhs,
            expected_ctc_lakhs: candidate.expected_ctc_lakhs,
            latest_disposition: candidate.latest_disposition,
          }}
        />
      )}

      <Tabs defaultValue="details">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="history">Call History</TabsTrigger>
          <TabsTrigger value="resume">Resume</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4 mt-4">
          {/* AI insights live inline with the candidate's details — not on a separate tab */}
          <CandidateScoreCard candidateId={candidate.id} />
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {candidate.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{candidate.phone}</span>
                </div>
              )}
              {candidate.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{candidate.email}</span>
                </div>
              )}
              {candidate.current_location && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{candidate.current_location}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Professional Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="font-medium">Position: </span>
                  {candidate.position_applied_for}
                </div>
              </div>
              {candidate.current_company && (
                <div className="flex items-center gap-3">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="font-medium">Current Company: </span>
                    {candidate.current_company}
                  </div>
                </div>
              )}
              {candidate.total_experience_years && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="font-medium">Experience: </span>
                    {candidate.total_experience_years} years
                  </div>
                </div>
              )}
              {candidate.highest_qualification && (
                <div className="flex items-center gap-3">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="font-medium">Qualification: </span>
                    {candidate.highest_qualification}
                  </div>
                </div>
              )}
              {(candidate.current_ctc_lakhs !== null || candidate.expected_ctc_lakhs !== null) && (
                <div className="flex items-center gap-3">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="font-medium">CTC: </span>
                    ₹{(candidate.current_ctc_lakhs ?? 0).toFixed(1)}L current → ₹{(candidate.expected_ctc_lakhs ?? 0).toFixed(1)}L expected
                  </div>
                </div>
              )}
              {candidate.notice_period_days !== null && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="font-medium">Notice Period: </span>
                    {candidate.notice_period_days} days
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {candidate.key_skills && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Skills</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {candidate.key_skills.split(',').map((skill: string, index: number) => (
                    <Badge key={index} variant="outline">
                      {skill.trim()}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">AI Voice Calls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Hand the repetitive calls to the AI voice agent — interview reminders, availability confirmations, and offer follow-ups. It calls, confirms, and logs every outcome to Call History automatically, so recruiters keep their time for the conversations that matter.
              </p>
              <AIScreeningButton
                candidateId={candidate.id}
                candidateName={`${candidate.first_name} ${candidate.last_name}`}
                candidatePhone={candidate.phone}
              />
            </CardContent>
          </Card>
          <OfferCard candidateId={candidate.id} defaultCtc={candidate.expected_ctc_lakhs} />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ClipboardCheck className="h-5 w-5 text-green-600" />
                Candidate Onboarding
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {onboardingSubmission ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      onboardingSubmission.status === "approved" ? "default" :
                      onboardingSubmission.status === "rejected" ? "destructive" :
                      "secondary"
                    }>
                      {onboardingSubmission.status === "pending" ? "Form Submitted — Pending Review" :
                       onboardingSubmission.status === "documents_under_review" ? "Under Review" :
                       onboardingSubmission.status === "approved" ? "Approved" :
                       "Rejected"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Submitted {new Date(onboardingSubmission.created_at).toLocaleDateString("en-IN")}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Share the onboarding form with this candidate after a hiring decision. They will fill in their personal details, government IDs, bank details, and upload KYC documents.
                  </p>
                  {activeForm ? (
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                        https://ats-6t2.pages.dev/join/{activeForm.slug}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(`https://ats-6t2.pages.dev/join/${activeForm.slug}`);
                          toast.success("Onboarding link copied");
                        }}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy Link
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-amber-600">No active onboarding form found. Create one in <strong>HR Onboarding</strong>.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Application Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Applied on: </span>
                {formatDate(candidate.application_date)}
              </div>
              {candidate.latest_disposition && (
                <div>
                  <span className="font-medium">Last Disposition: </span>
                  {candidate.latest_disposition}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <CallHistory candidateId={candidate.id} showFilters={false} />
        </TabsContent>

        <TabsContent value="resume" className="mt-4">
          <div className="space-y-6">
            {/* Multiple Resumes Section */}
            {resumes.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Uploaded Resumes ({resumes.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {resumes.map((resume: any) => (
                    <div 
                      key={resume.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border",
                        resume.is_primary && "bg-primary/5 border-primary/30"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{resume.file_name}</span>
                            {resume.is_primary && (
                              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                                Primary
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Uploaded {new Date(resume.uploaded_at).toLocaleDateString('en-IN')}
                            {resume.file_size && ` • ${(resume.file_size / 1024).toFixed(1)} KB`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(resume.file_url, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <a href={resume.file_url} download={resume.file_name}>
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Legacy single resume display */}
            {candidate.resume_url && resumes.length === 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">Resume</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(candidate.resume_url!, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in New Tab
                  </Button>
                </div>
                <div className="border rounded-lg overflow-hidden bg-muted/50 min-h-[500px]">
                  {candidate.resume_url.toLowerCase().endsWith('.pdf') ? (
                    <iframe
                      src={candidate.resume_url}
                      className="w-full h-[600px]"
                      title="Resume Preview"
                    />
                  ) : candidate.resume_url.match(/\.(jpg|jpeg|png|webp|heic|heif)$/i) ? (
                    <img
                      src={candidate.resume_url}
                      alt="Resume"
                      className="w-full max-h-[600px] object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                      <FileText className="h-16 w-16 mb-4" />
                      <p>Preview not available for this file type</p>
                      <Button
                        variant="link"
                        onClick={() => window.open(candidate.resume_url!, '_blank')}
                      >
                        Download to view
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Preview for primary resume from new table */}
            {resumes.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Resume Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const primaryResume = resumes.find((r: any) => r.is_primary) || resumes[0];
                    const url = primaryResume?.file_url;
                    if (!url) return null;
                    
                    return (
                      <div className="border rounded-lg overflow-hidden bg-muted/50 min-h-[400px]">
                        {url.toLowerCase().endsWith('.pdf') ? (
                          <iframe
                            src={url}
                            className="w-full h-[500px]"
                            title="Resume Preview"
                          />
                        ) : url.match(/\.(jpg|jpeg|png|webp|heic|heif)$/i) ? (
                          <img
                            src={url}
                            alt="Resume"
                            className="w-full max-h-[500px] object-contain"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                            <FileText className="h-16 w-16 mb-4" />
                            <p>Preview not available for this file type</p>
                            <Button
                              variant="link"
                              onClick={() => window.open(url, '_blank')}
                            >
                              Download to view
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            {!candidate.resume_url && resumes.length === 0 && (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                <FileText className="h-16 w-16 mb-4" />
                <p>No resume uploaded</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}