import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Briefcase, MapPin, Clock, Building2, ThumbsUp, ThumbsDown, CalendarClock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface ShortlistCandidate {
  candidate_id: string;
  name: string;
  designation: string | null;
  current_company: string | null;
  experience_years: number | null;
  notice_period_days: number | null;
  key_skills: string | null;
  location: string | null;
  stage: string;
  client_decision: string | null;
  client_comment: string | null;
}

interface Shortlist {
  job_title: string;
  company_name: string | null;
  location: string | null;
  work_mode: string | null;
  min_experience_years: number | null;
  max_experience_years: number | null;
  number_of_positions: number | null;
  candidates: ShortlistCandidate[];
}

const DECISIONS = [
  { value: "accepted", label: "Accept", icon: ThumbsUp, className: "bg-green-600 hover:bg-green-700 text-white" },
  { value: "interview", label: "Request Interview", icon: CalendarClock, className: "bg-blue-600 hover:bg-blue-700 text-white" },
  { value: "rejected", label: "Reject", icon: ThumbsDown, className: "bg-red-600 hover:bg-red-700 text-white" },
];

const DECIDED_CHIP: Record<string, string> = {
  accepted: "bg-green-100 text-green-800 border-green-300",
  interview: "bg-blue-100 text-blue-800 border-blue-300",
  rejected: "bg-red-100 text-red-800 border-red-300",
};

export default function ClientShortlist() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [comments, setComments] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["client-shortlist", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_client_shortlist", { p_token: token! });
      if (error) throw error;
      return data as unknown as Shortlist;
    },
    enabled: !!token,
  });

  const decide = async (candidateId: string, decision: string) => {
    setSubmitting(candidateId + decision);
    try {
      const { error } = await supabase.rpc("submit_client_feedback", {
        p_token: token!,
        p_candidate_id: candidateId,
        p_decision: decision,
        p_comment: comments[candidateId] || null,
      });
      if (error) throw error;
      toast.success("Feedback recorded — the recruiting team has been notified");
      await queryClient.invalidateQueries({ queryKey: ["client-shortlist", token] });
    } catch (e: any) {
      toast.error(e.message || "Could not record feedback");
    } finally {
      setSubmitting(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-muted-foreground">This shortlist link is invalid or has been disabled.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-r from-blue-700 to-blue-500 text-white">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <p className="text-blue-100 text-sm font-semibold tracking-wide uppercase mb-2">Candidate Shortlist for Your Review</p>
          <h1 className="text-3xl font-bold">{data.job_title}</h1>
          <div className="flex flex-wrap gap-4 mt-3 text-blue-50 text-sm">
            {data.company_name && (
              <span className="flex items-center gap-1"><Building2 className="w-4 h-4" />{data.company_name}</span>
            )}
            {data.location && (
              <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{data.location}{data.work_mode ? ` · ${data.work_mode}` : ""}</span>
            )}
            {data.min_experience_years != null && (
              <span className="flex items-center gap-1"><Briefcase className="w-4 h-4" />{data.min_experience_years}–{data.max_experience_years} yrs</span>
            )}
          </div>
          <p className="text-blue-100 text-sm mt-3">
            Review each profile and mark your decision — your recruiting team is notified instantly.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-4">
        <p className="text-sm text-muted-foreground">{data.candidates.length} candidate(s) submitted</p>
        {data.candidates.map((c) => (
          <Card key={c.candidate_id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold">{c.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {[c.designation, c.current_company ? `at ${c.current_company}` : null].filter(Boolean).join(" ")}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                    {c.experience_years != null && (
                      <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{c.experience_years} yrs</span>
                    )}
                    {c.notice_period_days != null && (
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{c.notice_period_days}d notice</span>
                    )}
                    {c.location && (
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{c.location}</span>
                    )}
                  </div>
                  {c.key_skills && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {c.key_skills.split(",").slice(0, 8).map((s, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{s.trim()}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                {c.client_decision && (
                  <Badge variant="outline" className={`${DECIDED_CHIP[c.client_decision]} gap-1 flex-none`}>
                    <CheckCircle2 className="h-3 w-3" />
                    {c.client_decision === "interview" ? "Interview requested" : c.client_decision}
                  </Badge>
                )}
              </div>

              <div className="mt-4 space-y-2">
                <Textarea
                  placeholder="Optional comment for the recruiting team…"
                  rows={2}
                  value={comments[c.candidate_id] ?? c.client_comment ?? ""}
                  onChange={(e) => setComments({ ...comments, [c.candidate_id]: e.target.value })}
                  className="text-sm"
                />
                <div className="flex flex-wrap gap-2">
                  {DECISIONS.map((d) => {
                    const Icon = d.icon;
                    return (
                      <Button
                        key={d.value}
                        size="sm"
                        disabled={submitting === c.candidate_id + d.value}
                        className={d.className}
                        onClick={() => decide(c.candidate_id, d.value)}
                      >
                        <Icon className="h-4 w-4 mr-1" />
                        {d.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="max-w-4xl mx-auto px-6 pb-10">
        <p className="text-xs text-muted-foreground text-center">
          Contact details are shared after your acceptance · Powered by In-Sync ATS
        </p>
      </div>
    </div>
  );
}
