import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  CheckCircle,
  Loader2,
  MapPin,
  Clock,
  Building2,
  Search,
  X,
  IndianRupee,
  Filter,
  ChevronDown,
  Monitor,
  Home,
  Users,
  CreditCard,
  Fingerprint,
  ArrowRight,
  SkipForward,
  AlertCircle,
} from "lucide-react";
import atsLogo from "@/assets/ats-logo.png";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

interface RecruiterInfo {
  id: string;
  full_name: string | null;
  email: string;
}

interface Filters {
  search: string;
  location: string;
  workMode: string;
  minExperience: string;
  maxExperience: string;
  minSalary: string;
  maxSalary: string;
  skills: string[];
}

interface ParsedResumeData {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  current_location?: string;
  current_company?: string;
  designation?: string;
  total_experience_years?: number;
  current_ctc_lakhs?: number;
  expected_ctc_lakhs?: number;
  key_skills?: string;
  highest_qualification?: string;
}

type ApplicationStep = 'upload' | 'kyc' | 'success';

export default function PublicApply() {
  const { referralCode } = useParams<{ referralCode: string }>();
  const [loading, setLoading] = useState(true);
  const [recruiter, setRecruiter] = useState<RecruiterInfo | null>(null);
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [selectedMandates, setSelectedMandates] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    search: "",
    location: "",
    workMode: "",
    minExperience: "",
    maxExperience: "",
    minSalary: "",
    maxSalary: "",
    skills: [],
  });

  // Multi-step flow states
  const [applicationStep, setApplicationStep] = useState<ApplicationStep>('upload');
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [parsedResumeData, setParsedResumeData] = useState<ParsedResumeData | null>(null);

  // PAN verification states
  const [panNumber, setPanNumber] = useState('');
  const [panVerifying, setPanVerifying] = useState(false);
  const [panVerified, setPanVerified] = useState(false);
  const [panVerifiedData, setPanVerifiedData] = useState<{ name?: string; category?: string; aadhaar_linked?: string } | null>(null);
  const [panError, setPanError] = useState('');

  // Aadhaar verification states
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarRefId, setAadhaarRefId] = useState('');
  const [aadhaarOtpSent, setAadhaarOtpSent] = useState(false);
  const [aadhaarOtp, setAadhaarOtp] = useState('');
  const [aadhaarSendingOtp, setAadhaarSendingOtp] = useState(false);
  const [aadhaarVerifying, setAadhaarVerifying] = useState(false);
  const [aadhaarVerified, setAadhaarVerified] = useState(false);
  const [aadhaarVerifiedData, setAadhaarVerifiedData] = useState<{ name?: string; dob?: string; gender?: string; address?: string } | null>(null);
  const [aadhaarError, setAadhaarError] = useState('');

  // Extract unique values for filters
  const filterOptions = useMemo(() => {
    const locations = [...new Set(mandates.map((m) => m.job_location).filter(Boolean))];
    const workModes = [...new Set(mandates.map((m) => m.work_mode).filter(Boolean))];
    const allSkills = mandates.flatMap((m) => m.mandatory_skills || []);
    const skills = [...new Set(allSkills)].slice(0, 20);
    return { locations, workModes, skills };
  }, [mandates]);

  // Filter mandates
  const filteredMandates = useMemo(() => {
    return mandates.filter((mandate) => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          mandate.job_title.toLowerCase().includes(searchLower) ||
          mandate.job_description?.toLowerCase().includes(searchLower) ||
          mandate.mandatory_skills?.some((s) => s.toLowerCase().includes(searchLower)) ||
          mandate.clients?.company_name?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      if (filters.location && mandate.job_location !== filters.location) {
        return false;
      }

      if (filters.workMode && mandate.work_mode !== filters.workMode) {
        return false;
      }

      if (filters.minExperience) {
        const min = parseInt(filters.minExperience);
        if (mandate.max_experience_years < min) return false;
      }
      if (filters.maxExperience) {
        const max = parseInt(filters.maxExperience);
        if (mandate.min_experience_years > max) return false;
      }

      if (filters.minSalary) {
        const min = parseInt(filters.minSalary);
        if (mandate.max_ctc_lakhs < min) return false;
      }
      if (filters.maxSalary) {
        const max = parseInt(filters.maxSalary);
        if (mandate.min_ctc_lakhs > max) return false;
      }

      if (filters.skills.length > 0) {
        const hasSkill = filters.skills.some((skill) =>
          mandate.mandatory_skills?.some((s) => s.toLowerCase() === skill.toLowerCase())
        );
        if (!hasSkill) return false;
      }

      return true;
    });
  }, [mandates, filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.location) count++;
    if (filters.workMode) count++;
    if (filters.minExperience || filters.maxExperience) count++;
    if (filters.minSalary || filters.maxSalary) count++;
    if (filters.skills.length > 0) count++;
    return count;
  }, [filters]);

  const clearFilters = () => {
    setFilters({
      search: "",
      location: "",
      workMode: "",
      minExperience: "",
      maxExperience: "",
      minSalary: "",
      maxSalary: "",
      skills: [],
    });
  };

  useEffect(() => {
    fetchRecruiterAndMandates();
  }, [referralCode]);

  const fetchRecruiterAndMandates = async () => {
    if (!referralCode) {
      toast.error("Invalid referral link");
      setLoading(false);
      return;
    }

    try {
      const { data: recruiterData, error: recruiterError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("referral_code", referralCode)
        .single();

      if (recruiterError || !recruiterData) {
        console.error("Recruiter fetch error:", recruiterError);
        toast.error("Invalid or expired referral link");
        setLoading(false);
        return;
      }

      setRecruiter(recruiterData);

      const { data: mandatesData, error: mandatesError } = await supabase
        .from("mandates")
        .select(`
          id, job_title, job_location, employment_type, 
          min_experience_years, max_experience_years,
          min_ctc_lakhs, max_ctc_lakhs, job_description,
          mandatory_skills, work_mode,
          clients(company_name)
        `)
        .eq("mandate_status", "open")
        .order("created_at", { ascending: false });

      if (mandatesError) throw mandatesError;
      setMandates(mandatesData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load application page");
    } finally {
      setLoading(false);
    }
  };

  const acceptedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  const validateFile = (file: File): boolean => {
    if (!acceptedTypes.includes(file.type)) {
      toast.error("Please upload a PDF, Word document, or image file");
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return false;
    }
    return true;
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && validateFile(droppedFile)) {
      setFile(droppedFile);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && validateFile(selectedFile)) {
      setFile(selectedFile);
    }
  };

  const handleSubmit = async () => {
    if (!file || !recruiter) {
      toast.error("Please upload your resume");
      return;
    }

    setUploading(true);
    setUploadDialogOpen(false);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `applications/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("public-resumes")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("public-resumes").getPublicUrl(filePath);

      setUploading(false);
      setParsing(true);

      const { data: parseResult, error: parseError } = await supabase.functions.invoke(
        "parse-resume",
        { body: { fileUrl: publicUrl } }
      );

      if (parseError) {
        console.error("Parse error:", parseError);
      }

      // Insert application for each selected mandate (or one general application)
      const applicationInserts = selectedMandates.length > 0
        ? selectedMandates.map(mandateId => ({
            referral_code: referralCode,
            recruiter_id: recruiter.id,
            mandate_id: mandateId,
            resume_url: publicUrl,
            resume_file_name: file.name,
            parsed_data: parseResult?.data || {},
            status: "pending",
          }))
        : [{
            referral_code: referralCode,
            recruiter_id: recruiter.id,
            mandate_id: null,
            resume_url: publicUrl,
            resume_file_name: file.name,
            parsed_data: parseResult?.data || {},
            status: "pending",
          }];

      const { error: applicationError } = await supabase.from("public_job_applications").insert(applicationInserts);

      if (applicationError) throw applicationError;

      const parsedData = parseResult?.data || {};
      setParsedResumeData(parsedData);

      // Create candidate immediately
      const { data: candidateData, error: candidateError } = await supabase.from("candidates").insert({
        first_name: parsedData.first_name || "Unknown",
        last_name: parsedData.last_name || "Candidate",
        email: parsedData.email || null,
        phone: parsedData.phone || null,
        position_applied_for: selectedMandates.length > 0
          ? mandates.filter((m) => selectedMandates.includes(m.id)).map(m => m.job_title).join(', ') || "General Application"
          : "General Application",
        current_status: "applied",
        resume_url: publicUrl,
        source: "referral",
        source_recruiter_id: recruiter.id,
        created_by: recruiter.id,
        assigned_recruiter: recruiter.id,
        assigned_at: new Date().toISOString(),
        is_fresh_application: true,
        application_submitted_at: new Date().toISOString(),
        current_location: parsedData.current_location || null,
        current_company: parsedData.current_company || null,
        designation: parsedData.designation || null,
        total_experience_years: parsedData.total_experience_years || null,
        current_ctc_lakhs: parsedData.current_ctc_lakhs || null,
        expected_ctc_lakhs: parsedData.expected_ctc_lakhs || null,
        key_skills: parsedData.key_skills || null,
        highest_qualification: parsedData.highest_qualification || null,
      }).select('id').single();

      if (candidateError) {
        console.error("Candidate creation error:", candidateError);
        throw candidateError;
      }

      setCandidateId(candidateData.id);
      setParsing(false);
      
      // Move to KYC step
      setApplicationStep('kyc');
      toast.success("Application submitted! You can now optionally verify your documents.");
    } catch (error: unknown) {
      console.error("Submit error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to submit application";
      toast.error(errorMessage);
      setUploading(false);
      setParsing(false);
    }
  };

  // PAN Verification
  const handleVerifyPan = async () => {
    if (!panNumber || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(panNumber)) {
      setPanError('Invalid PAN format. Expected: ABCDE1234F');
      return;
    }

    setPanError('');
    setPanVerifying(true);

    try {
      const { data, error } = await supabase.functions.invoke('verify-pan', {
        body: { pan: panNumber.toUpperCase(), candidateId }
      });

      if (error) throw error;

      if (data.success && data.verified) {
        setPanVerified(true);
        setPanVerifiedData(data.data);
        toast.success('PAN verified successfully!');
      } else {
        setPanError(data.error || 'PAN verification failed');
      }
    } catch (error: unknown) {
      console.error('PAN verification error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to verify PAN';
      setPanError(errorMessage);
    } finally {
      setPanVerifying(false);
    }
  };

  // Aadhaar OTP Send
  const handleSendAadhaarOtp = async () => {
    const cleanAadhaar = aadhaarNumber.replace(/\s/g, '');
    if (!/^\d{12}$/.test(cleanAadhaar)) {
      setAadhaarError('Invalid Aadhaar format. Expected 12 digits.');
      return;
    }

    setAadhaarError('');
    setAadhaarSendingOtp(true);

    try {
      const { data, error } = await supabase.functions.invoke('aadhaar-send-otp', {
        body: { aadhaar: cleanAadhaar }
      });

      if (error) throw error;

      if (data.success) {
        setAadhaarRefId(data.reference_id);
        setAadhaarOtpSent(true);
        toast.success('OTP sent to your registered mobile number');
      } else {
        setAadhaarError(data.error || 'Failed to send OTP');
      }
    } catch (error: unknown) {
      console.error('Aadhaar OTP error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send OTP';
      setAadhaarError(errorMessage);
    } finally {
      setAadhaarSendingOtp(false);
    }
  };

  // Aadhaar OTP Verify
  const handleVerifyAadhaarOtp = async () => {
    if (!/^\d{6}$/.test(aadhaarOtp)) {
      setAadhaarError('Invalid OTP format. Expected 6 digits.');
      return;
    }

    setAadhaarError('');
    setAadhaarVerifying(true);

    try {
      const { data, error } = await supabase.functions.invoke('aadhaar-verify-otp', {
        body: { reference_id: aadhaarRefId, otp: aadhaarOtp, candidateId }
      });

      if (error) throw error;

      if (data.success && data.verified) {
        setAadhaarVerified(true);
        setAadhaarVerifiedData(data.data);
        toast.success('Aadhaar verified successfully!');
      } else {
        setAadhaarError(data.error || 'Aadhaar verification failed');
      }
    } catch (error: unknown) {
      console.error('Aadhaar verification error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to verify Aadhaar';
      setAadhaarError(errorMessage);
    } finally {
      setAadhaarVerifying(false);
    }
  };

  const handleCompleteApplication = () => {
    setApplicationStep('success');
  };

  const getWorkModeIcon = (mode: string) => {
    switch (mode?.toLowerCase()) {
      case "remote":
        return <Home className="h-3 w-3" />;
      case "hybrid":
        return <Users className="h-3 w-3" />;
      default:
        return <Monitor className="h-3 w-3" />;
    }
  };

  const getWorkModeColor = (mode: string) => {
    switch (mode?.toLowerCase()) {
      case "remote":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "hybrid":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
      default:
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!recruiter) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center bg-card rounded-xl p-8 shadow-lg border">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
            <X className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Invalid Link</h2>
          <p className="text-muted-foreground">This referral link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  // Success Screen
  if (applicationStep === 'success') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center bg-card rounded-xl p-8 shadow-lg border">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-4">Application Submitted!</h2>
          
          <div className="space-y-3 mb-6 text-left">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <FileText className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Resume</p>
                <p className="text-xs text-muted-foreground">Uploaded & Parsed ✓</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <CreditCard className="h-5 w-5" style={{ color: panVerified ? '#22c55e' : '#9ca3af' }} />
              <div>
                <p className="text-sm font-medium">PAN Card</p>
                <p className="text-xs text-muted-foreground">
                  {panVerified ? `Verified: ${panVerifiedData?.name}` : 'Not submitted'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Fingerprint className="h-5 w-5" style={{ color: aadhaarVerified ? '#22c55e' : '#9ca3af' }} />
              <div>
                <p className="text-sm font-medium">Aadhaar Card</p>
                <p className="text-xs text-muted-foreground">
                  {aadhaarVerified ? `Verified: ${aadhaarVerifiedData?.name}` : 'Not submitted'}
                </p>
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Referred by: <span className="font-medium">{recruiter.full_name || recruiter.email}</span>
          </p>
        </div>
      </div>
    );
  }

  // KYC Verification Screen
  if (applicationStep === 'kyc') {
    return (
      <div className="min-h-screen bg-muted/30">
        <header className="sticky top-0 z-50 bg-background border-b shadow-sm">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <img src={atsLogo} alt="ATS Logo" className="h-40 w-40 object-contain" />
                <div>
                  <h1 className="text-lg font-bold text-foreground">Identity Verification</h1>
                  <p className="text-xs text-muted-foreground">Optional step for faster processing</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          {/* Applicant Info Preview */}
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Application Submitted
              </CardTitle>
              <CardDescription>Your resume has been uploaded and processed</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>
                  <p className="font-medium">{parsedResumeData?.first_name} {parsedResumeData?.last_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span>
                  <p className="font-medium">{parsedResumeData?.email || 'Not provided'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone:</span>
                  <p className="font-medium">{parsedResumeData?.phone || 'Not provided'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Experience:</span>
                  <p className="font-medium">{parsedResumeData?.total_experience_years || 0} years</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Verify Your Identity (Optional)</h2>
            <p className="text-muted-foreground text-sm">
              Verifying your PAN and Aadhaar helps speed up the hiring process. You can skip this step if you prefer.
            </p>
          </div>

          <div className="space-y-6">
            {/* PAN Verification Card */}
            <Card className={panVerified ? 'border-green-500' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  PAN Card Verification
                  {panVerified && <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />}
                </CardTitle>
                <CardDescription>
                  Enter your 10-character PAN number (e.g., ABCDE1234F)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {panVerified ? (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="font-medium text-green-700 dark:text-green-400">Verified Successfully</p>
                    <div className="mt-2 text-sm space-y-1">
                      <p><span className="text-muted-foreground">Name:</span> {panVerifiedData?.name}</p>
                      <p><span className="text-muted-foreground">Category:</span> {panVerifiedData?.category}</p>
                      {panVerifiedData?.aadhaar_linked && (
                        <p><span className="text-muted-foreground">Aadhaar Linked:</span> {panVerifiedData.aadhaar_linked === 'y' ? 'Yes' : 'No'}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="ABCDE1234F"
                        value={panNumber}
                        onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                        maxLength={10}
                        className="uppercase"
                      />
                      <Button onClick={handleVerifyPan} disabled={panVerifying || !panNumber}>
                        {panVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                      </Button>
                    </div>
                    {panError && (
                      <div className="flex items-center gap-2 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        {panError}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Aadhaar Verification Card */}
            <Card className={aadhaarVerified ? 'border-green-500' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Fingerprint className="h-5 w-5" />
                  Aadhaar Card Verification
                  {aadhaarVerified && <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />}
                </CardTitle>
                <CardDescription>
                  Enter your 12-digit Aadhaar number. An OTP will be sent to your registered mobile.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {aadhaarVerified ? (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="font-medium text-green-700 dark:text-green-400">Verified Successfully</p>
                    <div className="mt-2 text-sm space-y-1">
                      <p><span className="text-muted-foreground">Name:</span> {aadhaarVerifiedData?.name}</p>
                      <p><span className="text-muted-foreground">DOB:</span> {aadhaarVerifiedData?.dob}</p>
                      <p><span className="text-muted-foreground">Gender:</span> {aadhaarVerifiedData?.gender}</p>
                      {aadhaarVerifiedData?.address && (
                        <p><span className="text-muted-foreground">Address:</span> {aadhaarVerifiedData.address}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {!aadhaarOtpSent ? (
                      <div className="flex gap-2">
                        <Input
                          placeholder="1234 5678 9012"
                          value={aadhaarNumber}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            const formatted = val.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
                            setAadhaarNumber(formatted);
                          }}
                          maxLength={14}
                        />
                        <Button onClick={handleSendAadhaarOtp} disabled={aadhaarSendingOtp || !aadhaarNumber}>
                          {aadhaarSendingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send OTP'}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-400">
                          OTP sent to your Aadhaar-registered mobile number
                        </div>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Enter 6-digit OTP"
                            value={aadhaarOtp}
                            onChange={(e) => setAadhaarOtp(e.target.value.replace(/\D/g, ''))}
                            maxLength={6}
                          />
                          <Button onClick={handleVerifyAadhaarOtp} disabled={aadhaarVerifying || !aadhaarOtp}>
                            {aadhaarVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                          </Button>
                        </div>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => {
                            setAadhaarOtpSent(false);
                            setAadhaarOtp('');
                          }}
                        >
                          Change Aadhaar number
                        </Button>
                      </div>
                    )}
                    {aadhaarError && (
                      <div className="flex items-center gap-2 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        {aadhaarError}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mt-8">
            <Button variant="outline" className="flex-1" onClick={handleCompleteApplication}>
              <SkipForward className="h-4 w-4 mr-2" />
              Skip & Complete
            </Button>
            <Button className="flex-1" onClick={handleCompleteApplication}>
              Complete Application
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Upload Screen (Default)
  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Left: Branding */}
            <div className="flex items-center gap-3">
              <img 
                src={atsLogo} 
                alt="ATS Logo" 
                className="h-40 w-40 object-contain"
              />
              <div>
                <h1 className="text-lg font-bold text-foreground">Job Openings</h1>
                <p className="text-xs text-muted-foreground">
                  via {recruiter.full_name || recruiter.email}
                </p>
              </div>
            </div>

            {/* Right: Upload Button & Status */}
            <div className="flex items-center gap-3">
              {file && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 rounded-full">
                  <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm text-green-700 dark:text-green-400 max-w-32 truncate">
                    {file.name}
                  </span>
                  <button
                    onClick={() => setFile(null)}
                    className="hover:bg-green-200 dark:hover:bg-green-800 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3 text-green-600 dark:text-green-400" />
                  </button>
                </div>
              )}

              <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 shadow-md">
                    <Upload className="h-4 w-4" />
                    <span className="hidden sm:inline">{file ? "Change Resume" : "Upload Resume"}</span>
                    <span className="sm:hidden">Upload</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Upload Your Resume</DialogTitle>
                    <DialogDescription>
                      Upload your CV and we'll extract your information automatically
                    </DialogDescription>
                  </DialogHeader>
                  <div
                    className={`mt-4 border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      isDragging
                        ? "border-primary bg-primary/5"
                        : file
                        ? "border-green-500 bg-green-500/5"
                        : "border-muted-foreground/25 hover:border-primary/50"
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    {file ? (
                      <div className="flex flex-col items-center gap-3">
                        <FileText className="h-12 w-12 text-green-500" />
                        <div>
                          <p className="font-medium">{file.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setFile(null)}>
                          Choose Different File
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-lg font-medium mb-2">Drag & drop your resume here</p>
                        <p className="text-sm text-muted-foreground mb-4">
                          or click to browse (PDF, Word, or Image)
                        </p>
                        <input
                          type="file"
                          id="resume-upload-modal"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        <Button asChild variant="outline">
                          <label htmlFor="resume-upload-modal" className="cursor-pointer">
                            Browse Files
                          </label>
                        </Button>
                      </>
                    )}
                  </div>
                  {file && (
                    <Button onClick={handleSubmit} className="w-full mt-4" disabled={uploading || parsing}>
                      {uploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : parsing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        "Submit Application"
                      )}
                    </Button>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      {/* Filters Bar */}
      <div className="bg-background border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search jobs, skills, companies..."
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                className="pl-10 h-9"
              />
            </div>

            {/* Location Filter */}
            <Select
              value={filters.location}
              onValueChange={(v) => setFilters((f) => ({ ...f, location: v === "all" ? "" : v }))}
            >
              <SelectTrigger className="w-[140px] h-9">
                <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {filterOptions.locations.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Work Mode Filter */}
            <Select
              value={filters.workMode}
              onValueChange={(v) => setFilters((f) => ({ ...f, workMode: v === "all" ? "" : v }))}
            >
              <SelectTrigger className="w-[130px] h-9">
                <Monitor className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Work Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modes</SelectItem>
                {filterOptions.workModes.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {mode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Experience Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2">
                  <Clock className="h-4 w-4" />
                  Experience
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 p-3">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={filters.minExperience}
                      onChange={(e) => setFilters((f) => ({ ...f, minExperience: e.target.value }))}
                      className="h-8"
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={filters.maxExperience}
                      onChange={(e) => setFilters((f) => ({ ...f, maxExperience: e.target.value }))}
                      className="h-8"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">Years of experience</p>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Salary Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2">
                  <IndianRupee className="h-4 w-4" />
                  Salary
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 p-3">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={filters.minSalary}
                      onChange={(e) => setFilters((f) => ({ ...f, minSalary: e.target.value }))}
                      className="h-8"
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={filters.maxSalary}
                      onChange={(e) => setFilters((f) => ({ ...f, maxSalary: e.target.value }))}
                      className="h-8"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">Salary in LPA</p>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Skills Filter */}
            {filterOptions.skills.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-2">
                    <Filter className="h-4 w-4" />
                    Skills
                    {filters.skills.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                        {filters.skills.length}
                      </Badge>
                    )}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <ScrollArea className="h-64">
                    {filterOptions.skills.map((skill) => (
                      <DropdownMenuCheckboxItem
                        key={skill}
                        checked={filters.skills.includes(skill)}
                        onCheckedChange={(checked) => {
                          setFilters((f) => ({
                            ...f,
                            skills: checked
                              ? [...f.skills, skill]
                              : f.skills.filter((s) => s !== skill),
                          }));
                        }}
                      >
                        {skill}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </ScrollArea>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Clear Filters */}
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1 text-muted-foreground">
                <X className="h-4 w-4" />
                Clear ({activeFilterCount})
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Jobs Count */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredMandates.length}</span>{" "}
            {filteredMandates.length === 1 ? "position" : "positions"}
            {activeFilterCount > 0 && ` (filtered from ${mandates.length})`}
          </p>
          {selectedMandates.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              {selectedMandates.length} position{selectedMandates.length > 1 ? 's' : ''} selected
            </Badge>
          )}
        </div>
      </div>

      {/* Job Cards Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-24">
        {filteredMandates.length === 0 ? (
          <div className="text-center py-16">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No positions found</h3>
            <p className="text-muted-foreground mb-4">
              {activeFilterCount > 0
                ? "Try adjusting your filters to see more results"
                : "No open positions available at the moment"}
            </p>
            {activeFilterCount > 0 && (
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMandates.map((mandate) => {
              const isSelected = selectedMandates.includes(mandate.id);
              return (
              <div
                key={mandate.id}
                onClick={() => setSelectedMandates(prev => 
                  isSelected 
                    ? prev.filter(id => id !== mandate.id)
                    : [...prev, mandate.id]
                )}
                className={`group bg-card rounded-xl border p-4 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${
                  isSelected
                    ? "ring-2 ring-primary border-primary shadow-md"
                    : "hover:border-primary/50"
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {mandate.job_title}
                    </h3>
                    {mandate.clients?.company_name && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Building2 className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{mandate.clients.company_name}</span>
                      </p>
                    )}
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/30 group-hover:border-primary/50"
                    }`}
                  >
                    {isSelected && (
                      <CheckCircle className="h-3 w-3 text-primary-foreground" />
                    )}
                  </div>
                </div>

                {/* Info Row */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {mandate.job_location || "Remote"}
                  </span>
                  <span className="text-border">•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {mandate.min_experience_years}-{mandate.max_experience_years} yrs
                  </span>
                  <span className="text-border">•</span>
                  <span className="flex items-center gap-1">
                    <IndianRupee className="h-3 w-3" />
                    {mandate.min_ctc_lakhs}-{mandate.max_ctc_lakhs} LPA
                  </span>
                </div>

                {/* Work Mode Badge */}
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getWorkModeColor(
                      mandate.work_mode
                    )}`}
                  >
                    {getWorkModeIcon(mandate.work_mode)}
                    {mandate.work_mode}
                  </span>
                  <span className="text-xs text-muted-foreground capitalize">{mandate.employment_type}</span>
                </div>

                {/* Skills */}
                {mandate.mandatory_skills?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {mandate.mandatory_skills.slice(0, 4).map((skill, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs py-0 px-1.5 font-normal">
                        {skill}
                      </Badge>
                    ))}
                    {mandate.mandatory_skills.length > 4 && (
                      <Badge variant="outline" className="text-xs py-0 px-1.5 font-normal text-muted-foreground">
                        +{mandate.mandatory_skills.length - 4}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Submit Button */}
      {(file || selectedMandates.length > 0) && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t shadow-lg z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm">
                {file ? (
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-green-500" />
                    <span className="text-muted-foreground">Resume:</span>
                    <span className="font-medium truncate max-w-48">{file.name}</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Upload your resume to apply</span>
                )}
              </div>
              <Button
                onClick={() => (file ? handleSubmit() : setUploadDialogOpen(true))}
                disabled={uploading || parsing}
                className="min-w-40"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : parsing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : file ? (
                  "Submit Application"
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Resume
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
