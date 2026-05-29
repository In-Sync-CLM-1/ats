import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import {
  Building2,
  Users,
  Rocket,
  ArrowRight,
  ArrowLeft,
  Check,
  SkipForward,
  Upload,
  Plus,
  X,
  Image as ImageIcon,
  Layers,
  Briefcase,
  Loader2,
} from "lucide-react";

const INDUSTRIES = [
  "Recruitment & Staffing",
  "Information Technology",
  "Healthcare",
  "Finance & Banking",
  "Education",
  "Manufacturing",
  "Retail",
  "Logistics",
  "Hospitality",
  "Other",
];

const DEFAULT_PIPELINE_STAGES = [
  { name: "Sourced", order: 1, color: "#94a3b8" },
  { name: "Screened", order: 2, color: "#3b82f6" },
  { name: "Interviewing", order: 3, color: "#8b5cf6" },
  { name: "Offer", order: 4, color: "#f59e0b" },
  { name: "Hired", order: 5, color: "#10b981" },
  { name: "Rejected", order: 6, color: "#ef4444" },
];

const SUGGESTED_DESIGNATIONS = [
  "Software Engineer",
  "Senior Software Engineer",
  "Product Manager",
  "Data Analyst",
  "Sales Executive",
  "HR Business Partner",
  "Operations Manager",
  "Customer Support",
  "Designer",
  "Marketing Manager",
];

type StepId = "profile" | "pipeline" | "designations" | "invite" | "launch";

interface StepDef {
  id: StepId;
  title: string;
  icon: typeof Building2;
  description: string;
}

const STEPS: StepDef[] = [
  { id: "profile", title: "Business Profile", icon: Building2, description: "Tell us about your organization" },
  { id: "pipeline", title: "Pipeline Stages", icon: Layers, description: "Define your hiring pipeline" },
  { id: "designations", title: "Designations", icon: Briefcase, description: "Roles you typically hire for" },
  { id: "invite", title: "Invite Team", icon: Users, description: "Add your recruiters" },
  { id: "launch", title: "Launch", icon: Rocket, description: "You're all set!" },
];

export default function OnboardingWizard() {
  const { currentOrg, refreshOrgs, loading: orgLoading } = useOrg();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 1: Profile
  const [orgName, setOrgName] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Step 2: Pipeline
  const [stages, setStages] = useState(DEFAULT_PIPELINE_STAGES.map((s) => ({ ...s })));
  const [newStage, setNewStage] = useState("");

  // Step 3: Designations
  const [designations, setDesignations] = useState<string[]>([]);
  const [customDesignation, setCustomDesignation] = useState("");

  // Step 4: Invite
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/");
        return;
      }
      setAuthChecked(true);
    });
  }, [navigate]);

  useEffect(() => {
    if (currentOrg) {
      setOrgName(currentOrg.name);
      setIndustry(currentOrg.industry || "");
      setLogoPreview(currentOrg.logo_url);
    }
  }, [currentOrg]);

  // After auth + org context loaded, if there's no org, send to /create-org
  useEffect(() => {
    if (!authChecked || orgLoading) return;
    if (!currentOrg) navigate("/create-org");
  }, [authChecked, orgLoading, currentOrg, navigate]);

  if (!authChecked || orgLoading || !currentOrg) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const currentStepId = STEPS[step].id;
  const handleNext = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const handleBack = () => setStep((s) => Math.max(s - 1, 0));

  // ── Logo handling ──
  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be under 2MB.");
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return logoPreview;
    setUploadingLogo(true);
    const ext = logoFile.name.split(".").pop();
    const path = `${currentOrg.id}/logo.${ext}`;
    const { error } = await supabase.storage.from("org-logos").upload(path, logoFile, { upsert: true });
    setUploadingLogo(false);
    if (error) {
      toast.error(`Logo upload failed: ${error.message}`);
      return null;
    }
    const { data: urlData } = supabase.storage.from("org-logos").getPublicUrl(path);
    return urlData.publicUrl;
  };

  // ── Save business profile ──
  const handleSaveProfile = async () => {
    if (!orgName.trim()) {
      toast.error("Organization name is required.");
      return;
    }
    setLoading(true);
    try {
      let logoUrl = currentOrg.logo_url;
      if (logoFile) {
        logoUrl = await uploadLogo();
        if (!logoUrl) {
          setLoading(false);
          return;
        }
      }
      const { data, error } = await supabase.functions.invoke("manage-org", {
        body: { action: "update", org_id: currentOrg.id, name: orgName, website, industry, logo_url: logoUrl },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await refreshOrgs();
      toast.success("Profile saved");
      handleNext();
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    }
    setLoading(false);
  };

  // ── Pipeline stages ──
  const addStage = () => {
    if (!newStage.trim()) return;
    setStages([...stages, { name: newStage.trim(), order: stages.length + 1, color: "#6366f1" }]);
    setNewStage("");
  };

  const removeStage = (index: number) => {
    const next = stages.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 }));
    setStages(next);
  };

  const handleSaveStages = async () => {
    if (stages.length === 0) {
      toast.error("Add at least one pipeline stage.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-org", {
        body: { action: "seed_pipeline_stages", org_id: currentOrg.id, stages },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data?.skipped ? "Pipeline stages already configured" : "Pipeline stages saved");
      handleNext();
    } catch (err: any) {
      toast.error(err.message || "Failed to save stages");
    }
    setLoading(false);
  };

  // ── Designations ──
  const toggleDesignation = (title: string) => {
    setDesignations((prev) => (prev.includes(title) ? prev.filter((d) => d !== title) : [...prev, title]));
  };

  const addCustomDesignation = () => {
    const v = customDesignation.trim();
    if (!v || designations.includes(v)) return;
    setDesignations([...designations, v]);
    setCustomDesignation("");
  };

  const handleSaveDesignations = async () => {
    if (designations.length === 0) {
      handleNext();
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-org", {
        body: { action: "seed_designations", org_id: currentOrg.id, designations },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Saved ${designations.length} designation${designations.length === 1 ? "" : "s"}`);
      handleNext();
    } catch (err: any) {
      toast.error(err.message || "Failed to save designations");
    }
    setLoading(false);
  };

  // ── Invite team ──
  const handleInvite = async () => {
    if (!inviteEmail) {
      handleNext();
      return;
    }
    setLoading(true);
    try {
      const tempPassword = Math.random().toString(36).slice(-10) + "A1!";
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          email: inviteEmail,
          password: tempPassword,
          full_name: inviteName || inviteEmail.split("@")[0],
          role: "agent",
          org_id: currentOrg.id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Team member invited");
      setInviteEmail("");
      setInviteName("");
      handleNext();
    } catch (err: any) {
      toast.error(err.message || "Failed to invite team member");
    }
    setLoading(false);
  };

  // ── Complete onboarding ──
  const handleComplete = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-org", {
        body: { action: "complete_onboarding", org_id: currentOrg.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await refreshOrgs();
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      setTimeout(() => confetti({ particleCount: 100, spread: 100, origin: { y: 0.5 } }), 300);
      toast.success("Welcome aboard! Your workspace is ready.");
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (err: any) {
      toast.error(err.message || "Failed to complete onboarding");
    }
    setLoading(false);
  };

  const slideVariants = {
    enter: (direction: number) => ({ x: direction > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({ x: direction > 0 ? -300 : 300, opacity: 0 }),
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/5" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(circle, hsl(var(--primary)) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/8 blur-3xl" />

      {/* Stepper */}
      <div className="relative z-10 mb-8 flex items-center gap-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-1.5">
                <motion.div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                    i < step
                      ? "bg-primary text-primary-foreground"
                      : i === step
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                      : "bg-muted text-muted-foreground"
                  }`}
                  animate={{ scale: i === step ? 1.1 : 1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  {i < step ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </motion.div>
                <span
                  className={`hidden text-[10px] font-medium sm:block ${
                    i === step ? "text-primary" : i < step ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {s.title}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`mb-5 h-0.5 w-6 transition-colors sm:w-8 ${i < step ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          );
        })}
      </div>

      <Card className="relative z-10 w-full max-w-lg overflow-hidden border-border shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{STEPS[step].title}</CardTitle>
          <p className="text-sm text-muted-foreground">{STEPS[step].description}</p>
        </CardHeader>
        <CardContent>
          <AnimatePresence mode="wait" custom={1}>
            <motion.div
              key={step}
              custom={1}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {/* ══════ Profile ══════ */}
              {currentStepId === "profile" && (
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-3">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="group relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-muted-foreground/30 bg-muted/50 transition-colors hover:border-primary/50 hover:bg-muted"
                    >
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-muted-foreground">
                          <ImageIcon className="h-6 w-6" />
                          <span className="text-[10px]">Add Logo</span>
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <Upload className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handleLogoSelect}
                    />
                    <p className="text-xs text-muted-foreground">PNG, JPG or WebP, max 2MB</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Organization Name *</Label>
                    <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Acme Talent" />
                  </div>
                  <div className="space-y-2">
                    <Label>Website</Label>
                    <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://acme.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Industry</Label>
                    <Select value={industry} onValueChange={setIndustry}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select industry" />
                      </SelectTrigger>
                      <SelectContent>
                        {INDUSTRIES.map((ind) => (
                          <SelectItem key={ind} value={ind}>
                            {ind}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button onClick={handleSaveProfile} disabled={loading || uploadingLogo} className="gap-2">
                      {loading || uploadingLogo ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                        </>
                      ) : (
                        <>
                          Save & Continue <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* ══════ Pipeline Stages ══════ */}
              {currentStepId === "pipeline" && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    These are the stages every candidate moves through. Use the defaults or customize.
                  </p>

                  <div className="space-y-2">
                    {stages.map((s, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 rounded-lg border border-muted bg-muted/30 p-3"
                      >
                        <div
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        <span className="flex-1 text-sm font-medium">{s.name}</span>
                        <span className="text-xs text-muted-foreground">#{s.order}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeStage(i)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Input
                      value={newStage}
                      onChange={(e) => setNewStage(e.target.value)}
                      placeholder="Add custom stage (e.g. Background Check)"
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addStage())}
                    />
                    <Button variant="outline" size="icon" onClick={addStage} disabled={!newStage.trim()}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex justify-between gap-2 pt-4">
                    <Button variant="outline" onClick={handleBack} className="gap-2">
                      <ArrowLeft className="h-4 w-4" /> Back
                    </Button>
                    <Button onClick={handleSaveStages} disabled={loading} className="gap-2">
                      {loading ? "Saving..." : (
                        <>
                          Save & Continue <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* ══════ Designations ══════ */}
              {currentStepId === "designations" && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Pick the roles you commonly recruit for. You can add more anytime.
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {SUGGESTED_DESIGNATIONS.map((d) => {
                      const selected = designations.includes(d);
                      return (
                        <Badge
                          key={d}
                          variant={selected ? "default" : "outline"}
                          className="cursor-pointer select-none px-3 py-1.5 text-sm"
                          onClick={() => toggleDesignation(d)}
                        >
                          {selected && <Check className="mr-1 h-3 w-3" />}
                          {d}
                        </Badge>
                      );
                    })}
                  </div>

                  {designations.filter((d) => !SUGGESTED_DESIGNATIONS.includes(d)).length > 0 && (
                    <div className="space-y-2 rounded-lg border border-muted bg-muted/30 p-3">
                      <p className="text-xs font-medium text-muted-foreground">Custom designations</p>
                      <div className="flex flex-wrap gap-2">
                        {designations
                          .filter((d) => !SUGGESTED_DESIGNATIONS.includes(d))
                          .map((d) => (
                            <Badge key={d} variant="default" className="gap-1 px-3 py-1.5">
                              {d}
                              <X
                                className="h-3 w-3 cursor-pointer"
                                onClick={() => toggleDesignation(d)}
                              />
                            </Badge>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Input
                      value={customDesignation}
                      onChange={(e) => setCustomDesignation(e.target.value)}
                      placeholder="Add custom designation"
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomDesignation())}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={addCustomDesignation}
                      disabled={!customDesignation.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex justify-between gap-2 pt-4">
                    <Button variant="outline" onClick={handleBack} className="gap-2">
                      <ArrowLeft className="h-4 w-4" /> Back
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={handleNext} className="gap-2">
                        <SkipForward className="h-4 w-4" /> Skip
                      </Button>
                      <Button onClick={handleSaveDesignations} disabled={loading} className="gap-2">
                        {loading ? "Saving..." : (
                          <>
                            Save & Continue <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* ══════ Invite Team ══════ */}
              {currentStepId === "invite" && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Invite a teammate now or skip and add them later from the Users page.
                  </p>
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="Jane Recruiter"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="jane@company.com"
                      type="email"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    They'll be added as an agent. You can change roles later from the Users page.
                  </p>
                  <div className="flex justify-between gap-2 pt-4">
                    <Button variant="outline" onClick={handleBack} className="gap-2">
                      <ArrowLeft className="h-4 w-4" /> Back
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={handleNext} className="gap-2">
                        <SkipForward className="h-4 w-4" /> Skip
                      </Button>
                      <Button onClick={handleInvite} disabled={loading} className="gap-2">
                        {loading ? "Inviting..." : (
                          <>
                            Invite & Continue <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* ══════ Launch ══════ */}
              {currentStepId === "launch" && (
                <div className="space-y-6 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                    className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10"
                  >
                    <Rocket className="h-10 w-10 text-primary" />
                  </motion.div>
                  <div>
                    <h3 className="text-lg font-bold">You're all set!</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Your workspace is ready. Head to the dashboard to add your first mandate or candidate.
                    </p>
                  </div>
                  <div className="flex justify-between gap-2 pt-4">
                    <Button variant="outline" onClick={handleBack} className="gap-2">
                      <ArrowLeft className="h-4 w-4" /> Back
                    </Button>
                    <Button onClick={handleComplete} disabled={loading} className="gap-2" size="lg">
                      {loading ? "Completing..." : (
                        <>
                          Launch Dashboard <Rocket className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* ATS marketing ribbon */}
      <div className="relative z-10 mt-10 grid w-full max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { value: "5x", label: "Faster sourcing" },
          { value: "60%", label: "Less time-to-hire" },
          { value: "100%", label: "Pipeline visibility" },
          { value: "0", label: "Spreadsheets" },
        ].map(({ value, label }) => (
          <div
            key={label}
            className="rounded-lg border border-border/50 bg-card/60 px-4 py-3 text-center backdrop-blur-sm"
          >
            <p className="text-lg font-bold text-primary">{value}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
