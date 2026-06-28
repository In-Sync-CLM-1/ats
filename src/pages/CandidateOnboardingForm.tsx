import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OtpVerificationInput } from "@/components/onboarding/OtpVerificationInput";
import { Loader2, CheckCircle, Upload, FileText } from "lucide-react";
import { toast } from "sonner";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const GENDERS = ["Male", "Female", "Other"];
const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed"];

type DocType = "aadhaar" | "pan" | "qualification" | "relieving_letter" | "cancelled_cheque";
const DOC_LABELS: Record<DocType, string> = {
  aadhaar:         "Aadhaar Card *",
  pan:             "PAN Card *",
  qualification:   "Qualification Certificate",
  relieving_letter: "Appointment / Relieving Letter",
  cancelled_cheque: "Cancelled Cheque *",
};

interface FormData {
  full_name: string; gender: string; date_of_birth: string; marital_status: string;
  blood_group: string; qualifications: string; contact_number: string; personal_email: string;
  pan_number: string; aadhar_number: string; uan_number: string;
  father_name: string; mother_name: string; emergency_contact_number: string;
  present_address: string; permanent_address: string;
  bank_name: string; account_number: string; ifsc_code: string; branch_name: string;
}

const initial: FormData = {
  full_name: "", gender: "", date_of_birth: "", marital_status: "", blood_group: "",
  qualifications: "", contact_number: "", personal_email: "", pan_number: "",
  aadhar_number: "", uan_number: "", father_name: "", mother_name: "",
  emergency_contact_number: "", present_address: "", permanent_address: "",
  bank_name: "", account_number: "", ifsc_code: "", branch_name: "",
};

export default function CandidateOnboardingForm() {
  const { slug } = useParams<{ slug: string }>();
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState<FormData>(initial);
  const [emailVerified, setEmailVerified] = useState(false);
  const [documents, setDocuments] = useState<Record<DocType, File | null>>({
    aadhaar: null, pan: null, qualification: null, relieving_letter: null, cancelled_cheque: null,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  useEffect(() => {
    if (!slug) return;
    supabase.from("onboarding_forms").select("*").eq("slug", slug).eq("is_active", true).maybeSingle()
      .then(({ data }) => { setForm(data); setLoading(false); });
  }, [slug]);

  const set = (field: keyof FormData, value: string) => {
    setFormData(p => ({ ...p, [field]: value }));
    if (errors[field]) setErrors(p => ({ ...p, [field]: undefined }));
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!formData.full_name.trim()) e.full_name = "Name is required";
    if (!formData.contact_number.match(/^[6-9]\d{9}$/)) e.contact_number = "Valid 10-digit Indian mobile required";
    if (!formData.personal_email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.personal_email = "Valid email required";
    if (formData.pan_number && !formData.pan_number.match(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)) e.pan_number = "Invalid PAN (e.g. ABCDE1234F)";
    if (formData.aadhar_number && !formData.aadhar_number.match(/^\d{12}$/)) e.aadhar_number = "Aadhaar must be 12 digits";
    if (formData.ifsc_code && !formData.ifsc_code.match(/^[A-Z]{4}0[A-Z0-9]{6}$/)) e.ifsc_code = "Invalid IFSC code";
    if (formData.emergency_contact_number && !formData.emergency_contact_number.match(/^[6-9]\d{9}$/)) e.emergency_contact_number = "Valid 10-digit number required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) { toast.error("Please fix the errors before submitting"); return; }
    if (!emailVerified) { toast.error("Please verify your email first"); return; }

    setSubmitting(true);
    try {
      const submissionId = crypto.randomUUID();
      const { error: subErr } = await supabase.from("onboarding_submissions").insert({
        id: submissionId,
        form_id: form.id,
        org_id: form.org_id,
        ...formData,
        email_verified: true,
      });
      if (subErr) throw subErr;

      for (const [docType, file] of Object.entries(documents)) {
        if (!file) continue;
        const filePath = `${submissionId}/${docType}/${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("onboarding-documents")
          .upload(filePath, file);
        if (upErr) { console.error(`Upload error for ${docType}:`, upErr); continue; }
        await supabase.from("onboarding_documents").insert({
          submission_id: submissionId,
          document_type: docType,
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
        });
      }

      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (!form) return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-2">Form Not Found</h1>
      <p className="text-muted-foreground">This onboarding form is no longer available.</p>
    </div>
  );

  if (submitted) return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
      <h1 className="text-2xl font-bold mb-2">Thank You!</h1>
      <p className="text-muted-foreground max-w-md">
        Your onboarding details have been submitted successfully. The HR team will review your submission and get in touch with you.
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">{form.title}</h1>
          {form.description && <p className="text-muted-foreground">{form.description}</p>}
          <p className="text-sm text-muted-foreground">Fields marked * are required</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Personal Details */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Personal Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Full Name *</Label>
                <Input value={formData.full_name} onChange={e => set("full_name", e.target.value)} placeholder="As per government ID" />
                {errors.full_name && <p className="text-xs text-destructive mt-1">{errors.full_name}</p>}
              </div>
              <div>
                <Label>Gender</Label>
                <Select value={formData.gender} onValueChange={v => set("gender", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date of Birth</Label>
                <Input type="date" value={formData.date_of_birth} onChange={e => set("date_of_birth", e.target.value)} />
              </div>
              <div>
                <Label>Marital Status</Label>
                <Select value={formData.marital_status} onValueChange={v => set("marital_status", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{MARITAL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Blood Group</Label>
                <Select value={formData.blood_group} onValueChange={v => set("blood_group", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{BLOOD_GROUPS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Qualifications</Label>
                <Input value={formData.qualifications} onChange={e => set("qualifications", e.target.value)} placeholder="e.g. B.Tech, MBA" />
              </div>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Contact Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Mobile Number *</Label>
                <Input value={formData.contact_number} onChange={e => set("contact_number", e.target.value)} placeholder="10-digit mobile" maxLength={10} />
                {errors.contact_number && <p className="text-xs text-destructive mt-1">{errors.contact_number}</p>}
              </div>
              <div>
                <Label>Personal Email *</Label>
                <Input type="email" value={formData.personal_email} onChange={e => set("personal_email", e.target.value)} placeholder="your@email.com" />
                {errors.personal_email && <p className="text-xs text-destructive mt-1">{errors.personal_email}</p>}
              </div>
              <div className="md:col-span-2">
                <Label className="mb-2 block">Verify Email *</Label>
                <OtpVerificationInput
                  contact={formData.personal_email}
                  type="email"
                  onVerified={() => setEmailVerified(true)}
                  verified={emailVerified}
                  disabled={!formData.personal_email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)}
                />
              </div>
              <div>
                <Label>Emergency Contact Number</Label>
                <Input value={formData.emergency_contact_number} onChange={e => set("emergency_contact_number", e.target.value)} placeholder="10-digit mobile" maxLength={10} />
                {errors.emergency_contact_number && <p className="text-xs text-destructive mt-1">{errors.emergency_contact_number}</p>}
              </div>
            </CardContent>
          </Card>

          {/* Family */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Family Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Father's Name</Label>
                <Input value={formData.father_name} onChange={e => set("father_name", e.target.value)} />
              </div>
              <div>
                <Label>Mother's Name</Label>
                <Input value={formData.mother_name} onChange={e => set("mother_name", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* Government IDs */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Government IDs</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>PAN Number</Label>
                <Input value={formData.pan_number} onChange={e => set("pan_number", e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} />
                {errors.pan_number && <p className="text-xs text-destructive mt-1">{errors.pan_number}</p>}
              </div>
              <div>
                <Label>Aadhaar Number</Label>
                <Input value={formData.aadhar_number} onChange={e => set("aadhar_number", e.target.value.replace(/\D/g, ""))} placeholder="12-digit number" maxLength={12} />
                {errors.aadhar_number && <p className="text-xs text-destructive mt-1">{errors.aadhar_number}</p>}
              </div>
              <div>
                <Label>UAN Number</Label>
                <Input value={formData.uan_number} onChange={e => set("uan_number", e.target.value)} placeholder="Universal Account Number" />
              </div>
            </CardContent>
          </Card>

          {/* Address */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Address</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Present Address</Label>
                <Textarea value={formData.present_address} onChange={e => set("present_address", e.target.value)} rows={3} />
              </div>
              <div>
                <Label>Permanent Address</Label>
                <Textarea value={formData.permanent_address} onChange={e => set("permanent_address", e.target.value)} rows={3} />
              </div>
            </CardContent>
          </Card>

          {/* Bank Details */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Bank Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Bank Name</Label>
                <Input value={formData.bank_name} onChange={e => set("bank_name", e.target.value)} placeholder="e.g. State Bank of India" />
              </div>
              <div>
                <Label>Account Number</Label>
                <Input value={formData.account_number} onChange={e => set("account_number", e.target.value.replace(/\D/g, ""))} placeholder="Account number" />
              </div>
              <div>
                <Label>IFSC Code</Label>
                <Input value={formData.ifsc_code} onChange={e => set("ifsc_code", e.target.value.toUpperCase())} placeholder="SBIN0001234" maxLength={11} />
                {errors.ifsc_code && <p className="text-xs text-destructive mt-1">{errors.ifsc_code}</p>}
              </div>
              <div>
                <Label>Branch Name</Label>
                <Input value={formData.branch_name} onChange={e => set("branch_name", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Document Upload</CardTitle>
              <CardDescription>Upload clear scans or photos. Max 10MB per file.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(Object.keys(DOC_LABELS) as DocType[]).map(docType => (
                <div key={docType} className="flex items-center justify-between gap-4 p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{DOC_LABELS[docType]}</p>
                      {documents[docType] && (
                        <p className="text-xs text-muted-foreground">{documents[docType]!.name}</p>
                      )}
                    </div>
                  </div>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.heic"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) setDocuments(p => ({ ...p, [docType]: file }));
                      }}
                    />
                    <Button type="button" variant="outline" size="sm" asChild>
                      <span>
                        <Upload className="h-4 w-4 mr-1" />
                        {documents[docType] ? "Change" : "Upload"}
                      </span>
                    </Button>
                  </label>
                </div>
              ))}
            </CardContent>
          </Card>

          <Button type="submit" disabled={submitting || !emailVerified} className="w-full" size="lg">
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting…</> : "Submit Onboarding Form"}
          </Button>
          {!emailVerified && (
            <p className="text-center text-sm text-muted-foreground">Please verify your email before submitting.</p>
          )}
        </form>
      </div>
    </div>
  );
}
