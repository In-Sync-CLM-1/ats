import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarClock, Video, Phone, Building2, Star, Send } from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";

interface InterviewsCardProps {
  candidateId: string;
  candidateName: string;
  candidateEmail?: string | null;
}

const MODE_ICON: Record<string, typeof Video> = { video: Video, phone: Phone, in_person: Building2 };

const VERDICT_CHIP: Record<string, { label: string; className: string }> = {
  strong_yes: { label: "Strong Yes", className: "bg-green-600 text-white" },
  yes: { label: "Yes", className: "bg-green-100 text-green-800 border-green-300" },
  no: { label: "No", className: "bg-red-100 text-red-800 border-red-300" },
  strong_no: { label: "Strong No", className: "bg-red-600 text-white" },
};

const STATUS_CHIP: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800 border-blue-300",
  completed: "bg-green-100 text-green-800 border-green-300",
  cancelled: "bg-slate-100 text-slate-700 border-slate-300",
  no_show: "bg-amber-100 text-amber-800 border-amber-300",
};

export function InterviewsCard({ candidateId, candidateName, candidateEmail }: InterviewsCardProps) {
  const { currentOrg } = useOrg();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedbackFor, setFeedbackFor] = useState<string | null>(null);
  const [form, setForm] = useState({
    round_name: "Technical Round 1",
    scheduled_at: format(addDays(new Date(), 2), "yyyy-MM-dd'T'11:00"),
    mode: "video",
    meeting_link: "",
    interviewer_name: "",
    interviewer_email: "",
  });
  const [fb, setFb] = useState({ verdict: "", rating: "", feedback: "" });

  const { data: interviews = [] } = useQuery({
    queryKey: ["interviews", candidateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interviews")
        .select("*")
        .eq("candidate_id", candidateId)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!candidateId,
  });

  const schedule = async () => {
    if (!form.scheduled_at || !form.round_name) {
      toast.error("Round name and time are required");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("interviews").insert({
        org_id: currentOrg!.id,
        candidate_id: candidateId,
        round_name: form.round_name,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        mode: form.mode,
        meeting_link: form.meeting_link || null,
        interviewer_name: form.interviewer_name || null,
        interviewer_email: form.interviewer_email || null,
        created_by: user?.id,
      });
      if (error) throw error;

      // Email invites ride the existing sender — candidate + interviewer
      const when = format(new Date(form.scheduled_at), "EEEE, dd MMM yyyy 'at' h:mm a");
      const detailHtml =
        `<p><strong>${form.round_name}</strong> — ${when} (${form.mode.replace("_", " ")})</p>` +
        (form.meeting_link ? `<p>Meeting link: <a href="${form.meeting_link}">${form.meeting_link}</a></p>` : "");
      const sendTo: Array<{ email: string; name: string; intro: string }> = [];
      if (candidateEmail) sendTo.push({ email: candidateEmail, name: candidateName, intro: `Hi ${candidateName.split(" ")[0]}, your interview has been scheduled.` });
      if (form.interviewer_email) sendTo.push({ email: form.interviewer_email, name: form.interviewer_name || "Interviewer", intro: `You have been scheduled to interview ${candidateName}.` });
      for (const r of sendTo) {
        supabase.functions.invoke("send-simple-email", {
          body: {
            to_email: r.email,
            to_name: r.name,
            subject: `Interview scheduled — ${form.round_name}, ${when}`,
            html_body: `<p>${r.intro}</p>${detailHtml}<p>Best regards,<br/>${currentOrg?.name ?? "Recruitment Team"}</p>`,
          },
        }).catch(() => {/* invite email is best-effort */});
      }

      await queryClient.invalidateQueries({ queryKey: ["interviews", candidateId] });
      setShowForm(false);
      toast.success(`Interview scheduled${sendTo.length ? " — invites sent" : ""}`);
    } catch (e: any) {
      toast.error(e.message || "Could not schedule interview");
    } finally {
      setSaving(false);
    }
  };

  const saveFeedback = async (interviewId: string) => {
    if (!fb.verdict) {
      toast.error("Pick a verdict");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("interviews")
        .update({
          status: "completed",
          verdict: fb.verdict,
          rating: fb.rating ? Number(fb.rating) : null,
          feedback: fb.feedback || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", interviewId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["interviews", candidateId] });
      setFeedbackFor(null);
      setFb({ verdict: "", rating: "", feedback: "" });
      toast.success("Interview feedback recorded");
    } catch (e: any) {
      toast.error(e.message || "Could not save feedback");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarClock className="h-5 w-5 text-blue-600" />
          Interviews
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {interviews.length === 0 && !showForm && (
          <p className="text-sm text-muted-foreground">
            No rounds yet. Schedule one — invites go out by email, and the verdict gets recorded
            here so the whole team knows what happened.
          </p>
        )}

        {interviews.map((iv: any) => {
          const ModeIcon = MODE_ICON[iv.mode] ?? Video;
          const verdict = iv.verdict ? VERDICT_CHIP[iv.verdict] : null;
          return (
            <div key={iv.id} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm">
                  <span className="font-semibold">{iv.round_name}</span>
                  <span className="text-muted-foreground">
                    {" "}· {format(new Date(iv.scheduled_at), "dd MMM yyyy, h:mm a")}
                  </span>
                  <span className="text-muted-foreground inline-flex items-center gap-1 ml-2">
                    <ModeIcon className="h-3.5 w-3.5" />
                    {iv.mode.replace("_", " ")}
                  </span>
                  {iv.interviewer_name && (
                    <span className="text-muted-foreground"> · {iv.interviewer_name}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {verdict && <Badge className={verdict.className}>{verdict.label}</Badge>}
                  <Badge variant="outline" className={`${STATUS_CHIP[iv.status]} capitalize`}>{iv.status.replace("_", " ")}</Badge>
                </div>
              </div>
              {iv.rating != null && (
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className={`h-3.5 w-3.5 ${s <= iv.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                  ))}
                </div>
              )}
              {iv.feedback && <p className="text-sm text-muted-foreground border-l-2 border-blue-200 pl-3">{iv.feedback}</p>}

              {iv.status === "scheduled" && feedbackFor !== iv.id && (
                <Button variant="outline" size="sm" onClick={() => setFeedbackFor(iv.id)}>
                  Record Feedback
                </Button>
              )}
              {feedbackFor === iv.id && (
                <div className="grid gap-2 sm:grid-cols-2 pt-1">
                  <Select value={fb.verdict} onValueChange={(v) => setFb({ ...fb, verdict: v })}>
                    <SelectTrigger><SelectValue placeholder="Verdict" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="strong_yes">Strong Yes</SelectItem>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="strong_no">Strong No</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={fb.rating} onValueChange={(v) => setFb({ ...fb, rating: v })}>
                    <SelectTrigger><SelectValue placeholder="Rating (1–5)" /></SelectTrigger>
                    <SelectContent>
                      {[5, 4, 3, 2, 1].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n} — {["", "Poor", "Below par", "Decent", "Good", "Excellent"][n]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea
                    className="sm:col-span-2"
                    rows={2}
                    placeholder="What stood out, concerns, next-round focus…"
                    value={fb.feedback}
                    onChange={(e) => setFb({ ...fb, feedback: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={saving} onClick={() => saveFeedback(iv.id)}>Save Feedback</Button>
                    <Button size="sm" variant="ghost" onClick={() => setFeedbackFor(null)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {!showForm ? (
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            <CalendarClock className="h-4 w-4 mr-1" />
            Schedule Interview
          </Button>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 border rounded-lg p-4">
            <div>
              <Label className="text-xs">Round</Label>
              <Input value={form.round_name} onChange={(e) => setForm({ ...form, round_name: e.target.value })} placeholder="Technical Round 1" />
            </div>
            <div>
              <Label className="text-xs">Date & Time</Label>
              <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Mode</Label>
              <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="in_person">In person</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Meeting Link (optional)</Label>
              <Input value={form.meeting_link} onChange={(e) => setForm({ ...form, meeting_link: e.target.value })} placeholder="https://meet.google.com/…" />
            </div>
            <div>
              <Label className="text-xs">Interviewer Name</Label>
              <Input value={form.interviewer_name} onChange={(e) => setForm({ ...form, interviewer_name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Interviewer Email (gets the invite)</Label>
              <Input type="email" value={form.interviewer_email} onChange={(e) => setForm({ ...form, interviewer_email: e.target.value })} />
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <Button size="sm" disabled={saving} onClick={schedule}>
                <Send className="h-4 w-4 mr-1" />
                {saving ? "Scheduling…" : "Schedule & Send Invites"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
