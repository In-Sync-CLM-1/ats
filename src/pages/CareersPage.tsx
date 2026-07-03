import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Upload, FileText, CheckCircle, Loader2, MapPin, Clock,
  Building2, Search, IndianRupee, Monitor, Home, ChevronDown,
} from "lucide-react";
import atsLogo from "@/assets/ats-logo.png";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Mandate {
  id: string;
  job_title: string;
  job_location: string;
  employment_type: string;
  min_experience_years: number;
  max_experience_years: number;
  min_ctc_lakhs: number;
  max_ctc_lakhs: number;
  job_description: string;
  mandatory_skills: string[];
  work_mode: string;
  clients?: { company_name: string } | null;
}

interface OrgInfo {
  id: string;
  name: string;
  slug: string;
}

export default function CareersPage() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [selectedMandate, setSelectedMandate] = useState<Mandate | null>(null);
  const [search, setSearch] = useState("");
  const [workModeFilter, setWorkModeFilter] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        // Load org by slug
        const { data: orgData, error: orgErr } = await supabase
          .from("organizations")
          .select("id, name, slug")
          .eq("slug", slug)
          .single();
        if (orgErr || !orgData) { setLoading(false); return; }
        setOrg(orgData);

        // Load open mandates for this org
        const { data: mandateData } = await supabase
          .from("mandates")
          .select(`
            id, job_title, job_location, employment_type,
            min_experience_years, max_experience_years,
            min_ctc_lakhs, max_ctc_lakhs, job_description,
            mandatory_skills, work_mode, clients(company_name)
          `)
          .eq("mandate_status", "open")
          .eq("org_id", orgData.id)
          .order("created_at", { ascending: false });

        setMandates(mandateData || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const workModes = useMemo(() => [...new Set(mandates.map(m => m.work_mode).filter(Boolean))], [mandates]);

  const filtered = useMemo(() => mandates.filter(m => {
    if (search && !m.job_title.toLowerCase().includes(search.toLowerCase()) &&
        !m.mandatory_skills?.some(s => s.toLowerCase().includes(search.toLowerCase()))) return false;
    if (workModeFilter && m.work_mode !== workModeFilter) return false;
    return true;
  }), [mandates, search, workModeFilter]);

  const workModeIcon = (mode: string) => {
    if (mode === "remote") return <Home className="w-3.5 h-3.5" />;
    if (mode === "hybrid") return <Monitor className="w-3.5 h-3.5" />;
    return <Building2 className="w-3.5 h-3.5" />;
  };

  const handleApply = async () => {
    if (!file || !org) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `careers/${org.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("resumes").upload(path, file);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("resumes").getPublicUrl(path);
      await supabase.from("public_job_applications").insert({
        resume_url: publicUrl,
        resume_file_name: file.name,
        mandate_id: selectedMandate?.id || null,
        status: "pending",
        parsed_data: {},
      });
      setSubmitted(true);
    } catch (e: any) {
      toast.error("Failed to submit application. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800">Organisation not found</h2>
          <p className="text-gray-500 mt-2">This careers page does not exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={org.logo_url || atsLogo} alt={org.name} className="h-9 w-auto" />
          </div>
          <Dialog open={dialogOpen} onOpenChange={v => { setDialogOpen(v); if (!v) { setFile(null); setSubmitted(false); setSelectedMandate(null); } }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Upload className="w-4 h-4 mr-2" /> Upload Resume
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {selectedMandate ? `Apply for ${selectedMandate.job_title}` : "Upload Your Resume"}
                </DialogTitle>
              </DialogHeader>
              {submitted ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-gray-800">Application Submitted!</h3>
                  <p className="text-gray-500 mt-1 text-sm">We'll be in touch soon.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                      file ? "border-primary bg-primary/5" : "border-gray-200 hover:border-primary"
                    }`}
                    onClick={() => document.getElementById("careers-file-input")?.click()}
                  >
                    {file ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileText className="w-5 h-5 text-primary" />
                        <span className="text-sm font-medium text-primary truncate max-w-[200px]">{file.name}</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Drop your CV here or click to browse</p>
                        <p className="text-xs text-gray-400 mt-1">PDF, DOC, DOCX up to 10MB</p>
                      </>
                    )}
                    <input
                      id="careers-file-input"
                      type="file"
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                      onChange={e => setFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <Button className="w-full" disabled={!file || uploading} onClick={handleApply}>
                    {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…</> : "Submit Application"}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(600px 240px at 20% -20%, #ffffff, transparent), radial-gradient(500px 220px at 90% 120%, #93c5fd, transparent)" }} />
        <div className="relative max-w-5xl mx-auto px-6 py-16 text-center">
          <p className="text-blue-200 font-semibold tracking-[0.2em] text-xs uppercase mb-3">We're hiring</p>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">Careers at {org.name}</h2>
          <p className="mt-4 text-blue-100 text-lg max-w-2xl mx-auto">Explore open roles and apply in seconds — no account, no login. Just your résumé.</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Search + filters */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search roles, skills, companies…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {workModes.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  Work Mode <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuCheckboxItem checked={!workModeFilter} onCheckedChange={() => setWorkModeFilter("")}>All</DropdownMenuCheckboxItem>
                {workModes.map(m => (
                  <DropdownMenuCheckboxItem key={m} checked={workModeFilter === m} onCheckedChange={() => setWorkModeFilter(m === workModeFilter ? "" : m)}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Count */}
        <p className="text-sm text-gray-500 mb-4">
          Showing <span className="font-semibold text-gray-800">{filtered.length}</span> {filtered.length === 1 ? "position" : "positions"}
        </p>

        {/* Listings */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>No open positions found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(m => (
              <div
                key={m.id}
                className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg hover:border-blue-200 transition-all cursor-pointer"
                onClick={() => { setSelectedMandate(m); setDialogOpen(true); }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900">{m.job_title}</h3>
                    {m.clients?.company_name && (
                      <p className="text-sm text-gray-500 mt-0.5">{m.clients.company_name}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {m.job_location && (
                        <span className="flex items-center gap-1 text-xs text-gray-600">
                          <MapPin className="w-3 h-3" /> {m.job_location}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-xs text-gray-600">
                        <Clock className="w-3 h-3" /> {m.min_experience_years}–{m.max_experience_years} yrs
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-600">
                        <IndianRupee className="w-3 h-3" /> {m.min_ctc_lakhs}–{m.max_ctc_lakhs} LPA
                      </span>
                      {m.work_mode && (
                        <span className="flex items-center gap-1 text-xs text-gray-600 capitalize">
                          {workModeIcon(m.work_mode)} {m.work_mode}
                        </span>
                      )}
                      {m.employment_type && (
                        <Badge variant="outline" className="text-xs capitalize">{m.employment_type}</Badge>
                      )}
                    </div>
                    {m.mandatory_skills?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {m.mandatory_skills.slice(0, 5).map((s, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0">Apply</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
