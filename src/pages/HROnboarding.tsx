import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DocumentAIReview } from "@/components/onboarding/DocumentAIReview";
import { Plus, Copy, ExternalLink, Eye, Brain, Loader2, CheckCircle, XCircle, ToggleLeft, ToggleRight, FileDown } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useOrg } from "@/contexts/OrgContext";

const BASE_URL = "https://ats-6t2.pages.dev";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending:                  { label: "Pending",      variant: "outline" },
  documents_under_review:   { label: "Under Review", variant: "secondary" },
  approved:                 { label: "Approved",     variant: "default" },
  rejected:                 { label: "Rejected",     variant: "destructive" },
};

export default function HROnboarding() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrg();
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);

  const { data: forms, isLoading: formsLoading } = useQuery({
    queryKey: ["onboarding-forms", currentOrg?.id],
    queryFn: async () => {
      const q = supabase.from("onboarding_forms").select("*").order("created_at", { ascending: false });
      if (currentOrg?.id) q.eq("org_id", currentOrg.id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: submissions } = useQuery({
    queryKey: ["onboarding-submissions", currentOrg?.id],
    queryFn: async () => {
      const q = supabase
        .from("onboarding_submissions")
        .select("*, onboarding_forms(title), candidates(first_name, last_name)")
        .order("created_at", { ascending: false });
      if (currentOrg?.id) q.eq("org_id", currentOrg.id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: submissionDocs } = useQuery({
    queryKey: ["onboarding-docs", selectedSubmission?.id],
    queryFn: async () => {
      if (!selectedSubmission) return [];
      const { data, error } = await supabase
        .from("onboarding_documents")
        .select("*")
        .eq("submission_id", selectedSubmission.id);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedSubmission,
  });

  const createForm = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const slug = newSlug || newTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const { error } = await supabase.from("onboarding_forms").insert({
        title: newTitle,
        description: newDescription || null,
        slug,
        org_id: currentOrg?.id || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-forms"] });
      setCreateOpen(false);
      setNewTitle(""); setNewDescription(""); setNewSlug("");
      toast.success("Onboarding form created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleFormStatus = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("onboarding_forms").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["onboarding-forms"] }),
  });

  const approveSubmission = useMutation({
    mutationFn: async (submissionId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.rpc("approve_candidate_onboarding", {
        p_submission_id: submissionId,
        p_reviewer_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-submissions"] });
      if (selectedSubmission) setSelectedSubmission((p: any) => ({ ...p, status: "approved" }));
      toast.success("Submission approved and candidate updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rejectSubmission = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("onboarding_submissions").update({
        status: "rejected",
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-submissions"] });
      if (selectedSubmission) setSelectedSubmission((p: any) => ({ ...p, status: "rejected" }));
      toast.success("Submission rejected");
    },
  });

  const runAIAnalysis = async (submissionId: string) => {
    setAnalyzing(submissionId);
    try {
      const resp = await supabase.functions.invoke("analyze-onboarding-document", { body: { submission_id: submissionId } });
      if (resp.error) throw resp.error;
      queryClient.invalidateQueries({ queryKey: ["onboarding-submissions"] });
      if (selectedSubmission?.id === submissionId) {
        setSelectedSubmission((p: any) => p ? { ...p, ai_review_result: resp.data.analysis } : p);
      }
      toast.success(`AI analysis complete — risk score: ${resp.data.analysis.risk_score}/100`);
    } catch (e: any) {
      toast.error(e.message || "Analysis failed");
    } finally {
      setAnalyzing(null);
    }
  };

  const copyLink = (slug: string) => {
    const url = `${BASE_URL}/join/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  };

  const downloadDocument = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage.from("onboarding-documents").download(filePath);
    if (error) { toast.error(error.message); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Candidate Onboarding</h1>
          <p className="text-muted-foreground">Create forms and manage submitted onboarding details</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Form</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Onboarding Form</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Title *</Label>
                <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. June 2026 Joiners" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Optional note for candidates" rows={2} />
              </div>
              <div>
                <Label>URL Slug</Label>
                <Input value={newSlug} onChange={e => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="auto-generated from title" />
                <p className="text-xs text-muted-foreground mt-1">Leave blank to auto-generate</p>
              </div>
              <Button onClick={() => createForm.mutate()} disabled={!newTitle || createForm.isPending} className="w-full">
                {createForm.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create Form
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Forms list */}
      {formsLoading ? (
        <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : forms && forms.length > 0 ? (
        <Card>
          <CardHeader><CardTitle>Onboarding Forms</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forms.map((f: any) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.title}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">{f.slug}</TableCell>
                    <TableCell>
                      <Badge variant={f.is_active ? "default" : "secondary"}>
                        {f.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{format(new Date(f.created_at), "dd MMM yyyy")}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => copyLink(f.slug)} title="Copy link">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => window.open(`${BASE_URL}/join/${f.slug}`, "_blank")} title="Open form">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleFormStatus.mutate({ id: f.id, is_active: !f.is_active })} title={f.is_active ? "Deactivate" : "Activate"}>
                          {f.is_active ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground mb-4">No onboarding forms yet. Create one to get started.</p>
            <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" />Create First Form</Button>
          </CardContent>
        </Card>
      )}

      {/* Submissions */}
      <Card>
        <CardHeader>
          <CardTitle>Submissions</CardTitle>
          <CardDescription>Candidates who have completed the onboarding form</CardDescription>
        </CardHeader>
        <CardContent>
          {!submissions || submissions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No submissions yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Form</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((sub: any) => {
                  const st = STATUS_CONFIG[sub.status] || { label: sub.status, variant: "outline" as const };
                  return (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">{sub.full_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {sub.candidates ? `${sub.candidates.first_name} ${sub.candidates.last_name}` : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{sub.onboarding_forms?.title || "—"}</TableCell>
                      <TableCell className="text-sm">{format(new Date(sub.created_at), "dd MMM yyyy HH:mm")}</TableCell>
                      <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedSubmission(sub); setReviewOpen(true); }} title="View details">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" disabled={analyzing === sub.id} onClick={() => runAIAnalysis(sub.id)} title="AI analysis">
                            {analyzing === sub.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4 text-purple-500" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail sheet */}
      <Sheet open={reviewOpen} onOpenChange={setReviewOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedSubmission && (
            <>
              <SheetHeader className="mb-6">
                <SheetTitle>Onboarding Submission — {selectedSubmission.full_name}</SheetTitle>
              </SheetHeader>

              <div className="space-y-6">
                {/* Status & actions */}
                <div className="flex items-center justify-between">
                  {(() => {
                    const st = STATUS_CONFIG[selectedSubmission.status] || { label: selectedSubmission.status, variant: "outline" as const };
                    return <Badge variant={st.variant} className="text-sm">{st.label}</Badge>;
                  })()}
                  {selectedSubmission.status === "pending" || selectedSubmission.status === "documents_under_review" ? (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => approveSubmission.mutate(selectedSubmission.id)} disabled={approveSubmission.isPending}>
                        <CheckCircle className="h-4 w-4 mr-1" />Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => rejectSubmission.mutate(selectedSubmission.id)} disabled={rejectSubmission.isPending}>
                        <XCircle className="h-4 w-4 mr-1" />Reject
                      </Button>
                    </div>
                  ) : null}
                </div>

                {/* Personal info */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Personal Details</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {[
                      ["Name", selectedSubmission.full_name],
                      ["Gender", selectedSubmission.gender],
                      ["DOB", selectedSubmission.date_of_birth],
                      ["Marital Status", selectedSubmission.marital_status],
                      ["Blood Group", selectedSubmission.blood_group],
                      ["Qualifications", selectedSubmission.qualifications],
                      ["Mobile", selectedSubmission.contact_number],
                      ["Personal Email", selectedSubmission.personal_email],
                      ["Father's Name", selectedSubmission.father_name],
                      ["Mother's Name", selectedSubmission.mother_name],
                      ["Emergency Contact", selectedSubmission.emergency_contact_number],
                      ["PAN", selectedSubmission.pan_number],
                      ["Aadhaar", selectedSubmission.aadhar_number ? "****" + selectedSubmission.aadhar_number.slice(-4) : "—"],
                      ["UAN", selectedSubmission.uan_number],
                    ].map(([label, val]) => val ? (
                      <div key={label}>
                        <span className="text-muted-foreground">{label}: </span>
                        <span className="font-medium">{val}</span>
                      </div>
                    ) : null)}
                  </CardContent>
                </Card>

                {/* Bank */}
                {(selectedSubmission.bank_name || selectedSubmission.account_number) && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">Bank Details</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      {[
                        ["Bank", selectedSubmission.bank_name],
                        ["Account", selectedSubmission.account_number ? "****" + selectedSubmission.account_number.slice(-4) : null],
                        ["IFSC", selectedSubmission.ifsc_code],
                        ["Branch", selectedSubmission.branch_name],
                      ].map(([label, val]) => val ? (
                        <div key={label}>
                          <span className="text-muted-foreground">{label}: </span>
                          <span className="font-medium">{val}</span>
                        </div>
                      ) : null)}
                    </CardContent>
                  </Card>
                )}

                {/* Documents */}
                {submissionDocs && submissionDocs.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">Uploaded Documents</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {submissionDocs.map((doc: any) => (
                        <div key={doc.id} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <p className="text-sm font-medium capitalize">{doc.document_type.replace(/_/g, " ")}</p>
                            <p className="text-xs text-muted-foreground">{doc.file_name}</p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => downloadDocument(doc.file_path, doc.file_name)}>
                            <FileDown className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* AI analysis */}
                <DocumentAIReview analysis={selectedSubmission.ai_review_result} />
                {!selectedSubmission.ai_review_result && (
                  <Button variant="outline" className="w-full" disabled={analyzing === selectedSubmission.id} onClick={() => runAIAnalysis(selectedSubmission.id)}>
                    {analyzing === selectedSubmission.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Brain className="h-4 w-4 mr-2" />}
                    Run AI Document Analysis
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
