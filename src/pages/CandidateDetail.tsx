import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CallHistory } from "@/components/CallHistory";
import { CandidateScoreCard } from "@/components/CandidateScoreCard";
import { AIScreeningButton } from "@/components/AIScreeningButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Mail, MapPin, Briefcase, GraduationCap, Calendar, FileText, ExternalLink, ArrowLeft, Star, Download } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { cn } from "@/lib/utils";

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/candidates')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {candidate.first_name} {candidate.last_name}
          </h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant={
              candidate.current_status === 'hired' ? 'default' :
              candidate.current_status === 'interview' ? 'secondary' :
              candidate.current_status === 'rejected' ? 'destructive' :
              'outline'
            }>
              {candidate.current_status.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList className="grid w-full max-w-xl grid-cols-4">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="history">Call History</TabsTrigger>
          <TabsTrigger value="resume">Resume</TabsTrigger>
          <TabsTrigger value="ai">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4 mt-4">
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

        <TabsContent value="ai" className="mt-4 space-y-4">
          <CandidateScoreCard candidateId={candidate.id} />
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">AI Voice Screening</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Initiate an AI-powered outbound screening call via Bolna. The AI agent will ask qualifying questions and the result will appear in Call History.
              </p>
              <AIScreeningButton
                candidateId={candidate.id}
                candidateName={`${candidate.first_name} ${candidate.last_name}`}
              />
            </CardContent>
          </Card>
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