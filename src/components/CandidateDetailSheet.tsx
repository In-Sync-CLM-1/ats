import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CallHistory } from "./CallHistory";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Mail, MapPin, Briefcase, GraduationCap, Calendar, FileText, ExternalLink } from "lucide-react";

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  position_applied_for: string;
  current_status: string;
  current_company: string | null;
  total_experience_years: number | null;
  current_location: string | null;
  assigned_recruiter: string | null;
  latest_disposition: string | null;
  application_date: string;
  created_at: string;
  highest_qualification: string | null;
  key_skills: string | null;
  matched_mandate_id: string | null;
  match_score: number | null;
  match_source: string | null;
  match_insights: any;
  resume_url: string | null;
}

interface CandidateDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: Candidate | null;
}

export function CandidateDetailSheet({
  open,
  onOpenChange,
  candidate,
}: CandidateDetailSheetProps) {
  if (!candidate) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="text-2xl">
            {candidate.first_name} {candidate.last_name}
          </SheetTitle>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant={
              candidate.current_status === 'hired' ? 'default' :
              candidate.current_status === 'interview' ? 'secondary' :
              candidate.current_status === 'rejected' ? 'destructive' :
              'outline'
            }>
              {candidate.current_status.replace('_', ' ').toUpperCase()}
            </Badge>
            {candidate.match_score && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                {candidate.match_score}% match
              </Badge>
            )}
          </div>
        </SheetHeader>

        <Tabs defaultValue="details" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="history">Call History</TabsTrigger>
            <TabsTrigger value="resume">Resume</TabsTrigger>
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
                    {candidate.key_skills.split(',').map((skill, index) => (
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

          <TabsContent value="resume" className="mt-4">
            {candidate.resume_url ? (
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
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                <FileText className="h-16 w-16 mb-4" />
                <p>No resume uploaded</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
