import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ArrowLeft, Pencil, Building2, Users, Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";

interface Mandate {
  id: string;
  job_title: string;
  mandate_status: string;
  priority_level: string;
  job_description: string;
  job_location: string;
  employment_type: string;
  work_mode: string;
  number_of_positions: number;
  positions_filled: number;
  min_experience_years: number;
  max_experience_years: number;
  min_ctc_lakhs: number;
  max_ctc_lakhs: number;
  mandatory_skills: string[];
  preferred_skills: string[];
  minimum_qualification: string;
  notice_period_acceptable: number;
  mandate_received_date: string;
  target_closure_date: string;
  created_at: string;
  client_id: string | null;
  clients?: {
    company_name: string;
    contact_name: string;
  } | null;
  assigned_recruiter_id: string | null;
  assigned_recruiter?: {
    full_name: string;
  } | null;
  project_team_members?: Array<{
    role_in_project: string;
    user_profile?: {
      full_name: string;
    } | null;
  }>;
}

export default function MandateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: mandate, isLoading } = useQuery({
    queryKey: ['mandate', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('mandates')
        .select(`
          *,
          clients(company_name, contact_name),
          project_team_members(role_in_project, user_id)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) return null;

      // Fetch assigned recruiter separately
      let assignedRecruiter = null;
      if (data.assigned_recruiter_id) {
        const { data: recruiterData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', data.assigned_recruiter_id)
          .single();
        
        assignedRecruiter = recruiterData;
      }

      // Fetch team member profiles separately
      let teamMembersWithProfiles: Array<{
        role_in_project: string;
        user_profile?: { full_name: string } | null;
      }> = [];

      if (data.project_team_members && data.project_team_members.length > 0) {
        const memberIds = data.project_team_members.map((m: any) => m.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', memberIds);

        teamMembersWithProfiles = data.project_team_members.map((member: any) => ({
          role_in_project: member.role_in_project,
          user_profile: profiles?.find(p => p.id === member.user_id) || null
        }));
      }

      return {
        ...data,
        assigned_recruiter: assignedRecruiter,
        project_team_members: teamMembersWithProfiles
      } as Mandate;
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      open: "default",
      closed: "outline",
      "on-hold": "secondary",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      high: "destructive",
      medium: "secondary",
      low: "secondary",
    };
    return <Badge variant={variants[priority] || "secondary"}>{priority}</Badge>;
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!mandate) {
    return (
      <div className="px-8 py-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Mandate not found</h2>
          <Button className="mt-4" onClick={() => navigate("/mandates")}>
            Back to Mandates
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/mandates")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{mandate.job_title}</h1>
            <p className="text-muted-foreground">
              Created on {format(new Date(mandate.created_at), "MMM dd, yyyy")}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {getStatusBadge(mandate.mandate_status)}
          {getPriorityBadge(mandate.priority_level)}
          <Button onClick={() => navigate(`/mandates/edit/${mandate.id}`)}>
            <Pencil className="w-4 h-4 mr-2" />
            Edit Mandate
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Positions Progress</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mandate.positions_filled}/{mandate.number_of_positions}
            </div>
            <p className="text-xs text-muted-foreground">Positions filled</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Timeline</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold">
              {format(new Date(mandate.target_closure_date), "MMM dd, yyyy")}
            </div>
            <p className="text-xs text-muted-foreground">Target closure</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compensation</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold">
              ₹{mandate.min_ctc_lakhs}L - ₹{mandate.max_ctc_lakhs}L
            </div>
            <p className="text-xs text-muted-foreground">CTC range</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Client</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold">
              {mandate.clients?.company_name || "Not assigned"}
            </div>
            <p className="text-xs text-muted-foreground">Company name</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Job Requirements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Experience</p>
              <p className="text-sm">
                {mandate.min_experience_years} - {mandate.max_experience_years} years
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Qualification</p>
              <p className="text-sm">{mandate.minimum_qualification || "Not specified"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Work Mode</p>
              <p className="text-sm capitalize">{mandate.work_mode}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Employment Type</p>
              <p className="text-sm capitalize">{mandate.employment_type}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Location</p>
              <p className="text-sm">{mandate.job_location || "Not specified"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Notice Period</p>
              <p className="text-sm">{mandate.notice_period_acceptable} days</p>
            </div>
            {mandate.mandatory_skills && mandate.mandatory_skills.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Mandatory Skills</p>
                <div className="flex flex-wrap gap-2">
                  {mandate.mandatory_skills.map((skill, idx) => (
                    <Badge key={idx} variant="default">{skill}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team & Assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Primary Recruiter</p>
              <p className="text-sm">{mandate.assigned_recruiter?.full_name || "Not assigned"}</p>
            </div>
            {mandate.project_team_members && mandate.project_team_members.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Team Members</p>
                <div className="space-y-2">
                  {mandate.project_team_members.map((member, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span>{member.user_profile?.full_name || "Unknown"}</span>
                      <Badge variant="outline">{member.role_in_project}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {mandate.job_description && (
        <Card>
          <CardHeader>
            <CardTitle>Job Description</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap">{mandate.job_description}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}