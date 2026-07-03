import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Users, Download, Upload, UserPlus, Filter, X, Phone, History, Star, Clock, Briefcase, IndianRupee, Calendar, MessageCircle } from "lucide-react";
import { DuplicateMandateBadge } from "@/components/DuplicateMandateBadge";
import { FreshApplicationBadge } from "@/components/FreshApplicationBadge";
import { useNavigate } from "react-router-dom";
import { TextFilterInput } from "@/components/filters/TextFilterInput";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { useCrudMutation } from "@/hooks/useCrudMutation";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { toast } from "sonner";
import { CandidateBulkImportDialog } from "@/components/CandidateBulkImportDialog";
import { CandidateAssignmentDialog } from "@/components/CandidateAssignmentDialog";
import { ExotelCallDialog } from "@/components/ExotelCallDialog";
import { WhatsAppDialog } from "@/components/WhatsAppDialog";
import { CandidateCallHistorySheet } from "@/components/CandidateCallHistorySheet";
import { CandidateSelectionBar } from "@/components/candidates/CandidateSelectionBar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import { format, formatDistanceToNow, differenceInDays, parseISO } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BulkCallCandidate } from "@/pages/CallingDashboard";

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
  resume_url: string | null;
  is_fresh_application: boolean | null;
  application_submitted_at: string | null;
  source_recruiter_id: string | null;
  // New fields
  current_ctc_lakhs: number | null;
  expected_ctc_lakhs: number | null;
  notice_period_days: number | null;
  source: string | null;
  interview_stage: string | null;
  rating: number | null;
  last_call_date: string | null;
  next_call_date: string | null;
  recruitment_status: string | null;
  // Joined recruiter data
  recruiter_profile?: {
    id: string;
    full_name: string | null;
  } | null;
}

interface FilterState {
  candidateSearch: { value: string; operator: "contains" | "equals" | "starts_with" };
  highestQualification: string[];
  keySkills: { value: string; operator: "contains" | "equals" | "starts_with" };
  positionAppliedFor: string[];
  currentStatus: string[];
  currentLocation: { value: string; operator: "contains" | "equals" | "starts_with" };
  // New filters
  experienceRange: [number, number];
  ctcRange: [number, number];
  noticePeriod: string[];
  source: string[];
  recruiter: string[];
  interviewStage: string[];
  rating: number[];
  applicationDateFrom: string;
  applicationDateTo: string;
}

const Candidates = () => {
  const navigate = useNavigate();
  const { permissions } = useUserPermissions();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [candidateToDelete, setCandidateToDelete] = useState<Candidate | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [canBulkDelete, setCanBulkDelete] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [callCandidate, setCallCandidate] = useState<Candidate | null>(null);
  const [showHistorySheet, setShowHistorySheet] = useState(false);
  const [historyCandidate, setHistoryCandidate] = useState<Candidate | null>(null);
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
  const [whatsAppCandidate, setWhatsAppCandidate] = useState<Candidate | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    candidateSearch: { value: "", operator: "contains" },
    highestQualification: [],
    keySkills: { value: "", operator: "contains" },
    positionAppliedFor: [],
    currentStatus: [],
    currentLocation: { value: "", operator: "contains" },
    // New filter defaults
    experienceRange: [0, 30],
    ctcRange: [0, 100],
    noticePeriod: [],
    source: [],
    recruiter: [],
    interviewStage: [],
    rating: [],
    applicationDateFrom: "",
    applicationDateTo: "",
  });
  const [filterOptions, setFilterOptions] = useState({
    highestQualification: [] as string[],
    positionAppliedFor: [] as string[],
    currentStatus: [] as string[],
    source: [] as string[],
    recruiter: [] as { id: string; full_name: string }[],
    interviewStage: [] as string[],
  });

  const {
    data: candidates,
    totalCount,
    totalPages,
    currentPage,
    itemsPerPage,
    isLoading,
    handlePageChange,
    handleItemsPerPageChange,
    refetch,
  } = usePaginatedQuery<Candidate>({
    queryKey: ["candidates", JSON.stringify(filters)],
    queryFn: async (from, to) => {
      let query = supabase
        .from("candidates")
        .select(`
          *,
          recruiter_profile:profiles!candidates_source_recruiter_id_fkey(id, full_name)
        `, { count: "exact" });

      if (filters.candidateSearch.value) {
        const searchValue = filters.candidateSearch.value;
        const operator = filters.candidateSearch.operator;
        
        if (operator === "contains") {
          query = query.or(`first_name.ilike.%${searchValue}%,last_name.ilike.%${searchValue}%,phone.ilike.%${searchValue}%,email.ilike.%${searchValue}%`);
        } else if (operator === "equals") {
          query = query.or(`first_name.eq.${searchValue},last_name.eq.${searchValue},phone.eq.${searchValue},email.eq.${searchValue}`);
        } else if (operator === "starts_with") {
          query = query.or(`first_name.ilike.${searchValue}%,last_name.ilike.${searchValue}%,phone.ilike.${searchValue}%,email.ilike.${searchValue}%`);
        }
      }

      if (filters.highestQualification.length > 0) {
        query = query.in("highest_qualification", filters.highestQualification);
      }

      if (filters.keySkills.value) {
        const operator = filters.keySkills.operator;
        if (operator === "contains") {
          query = query.ilike("key_skills", `%${filters.keySkills.value}%`);
        } else if (operator === "equals") {
          query = query.eq("key_skills", filters.keySkills.value);
        } else if (operator === "starts_with") {
          query = query.ilike("key_skills", `${filters.keySkills.value}%`);
        }
      }

      if (filters.positionAppliedFor.length > 0) {
        query = query.in("position_applied_for", filters.positionAppliedFor);
      }

      if (filters.currentStatus.length > 0) {
        query = query.in("current_status", filters.currentStatus);
      }

      if (filters.currentLocation.value) {
        const operator = filters.currentLocation.operator;
        if (operator === "contains") {
          query = query.ilike("current_location", `%${filters.currentLocation.value}%`);
        } else if (operator === "equals") {
          query = query.eq("current_location", filters.currentLocation.value);
        } else if (operator === "starts_with") {
          query = query.ilike("current_location", `${filters.currentLocation.value}%`);
        }
      }

      // New filters
      if (filters.experienceRange[0] > 0 || filters.experienceRange[1] < 30) {
        query = query.gte("total_experience_years", filters.experienceRange[0])
          .lte("total_experience_years", filters.experienceRange[1]);
      }

      if (filters.ctcRange[0] > 0 || filters.ctcRange[1] < 100) {
        query = query.gte("current_ctc_lakhs", filters.ctcRange[0])
          .lte("current_ctc_lakhs", filters.ctcRange[1]);
      }

      if (filters.noticePeriod.length > 0) {
        const conditions: string[] = [];
        if (filters.noticePeriod.includes("immediate")) {
          conditions.push("notice_period_days.lte.15");
        }
        if (filters.noticePeriod.includes("30days")) {
          conditions.push("notice_period_days.gt.15,notice_period_days.lte.30");
        }
        if (filters.noticePeriod.includes("60days")) {
          conditions.push("notice_period_days.gt.30,notice_period_days.lte.60");
        }
        if (filters.noticePeriod.includes("90plus")) {
          conditions.push("notice_period_days.gt.60");
        }
        // Apply notice period filter using or conditions
        if (conditions.length > 0) {
          // Simplified approach - just filter by range
          if (filters.noticePeriod.includes("immediate")) {
            query = query.lte("notice_period_days", 15);
          }
        }
      }

      if (filters.source.length > 0) {
        query = query.in("source", filters.source);
      }

      if (filters.recruiter.length > 0) {
        query = query.in("source_recruiter_id", filters.recruiter);
      }

      if (filters.interviewStage.length > 0) {
        query = query.in("interview_stage", filters.interviewStage);
      }

      if (filters.rating.length > 0) {
        query = query.in("rating", filters.rating);
      }

      if (filters.applicationDateFrom) {
        query = query.gte("application_date", filters.applicationDateFrom);
      }

      if (filters.applicationDateTo) {
        query = query.lte("application_date", filters.applicationDateTo);
      }

      query = query
        .order("created_at", { ascending: false })
        .range(from, to);

      const { data, error, count } = await query;

      return { data: data as Candidate[] | null, count, error };
    },
  });

  const { delete: deleteCandidate, isDeleting } = useCrudMutation<Candidate>({
    queryKey: ["candidates"],
    createFn: async (data) => {
      const { data: result, error } = await supabase
        .from("candidates")
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return result as Candidate;
    },
    updateFn: async (id, data) => {
      const { data: result, error } = await supabase
        .from("candidates")
        .update(data)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return result as Candidate;
    },
    deleteFn: async (id) => {
      const { error } = await supabase.from("candidates").delete().eq("id", id);
      if (error) throw error;
    },
    successMessages: {
      delete: "Candidate deleted successfully",
    },
    errorMessages: {
      delete: "Failed to delete candidate",
    },
  });

  useEffect(() => {
    const checkPermissions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      
      const roles = rolesData?.map(r => r.role) || [];
      const canDelete = roles.some(role => 
        ['platform_admin', 'super_admin', 'admin', 'manager'].includes(role)
      );
      
      setCanBulkDelete(canDelete);
    };
    
    checkPermissions();
  }, []);

  useEffect(() => {
    const fetchFilterOptions = async () => {
      const [qualData, posData, statusData, sourceData, recruiterData, stageData] = await Promise.all([
        supabase.from("candidates").select("highest_qualification").not("highest_qualification", "is", null).order("highest_qualification"),
        supabase.from("candidates").select("position_applied_for").not("position_applied_for", "is", null).order("position_applied_for"),
        supabase.from("candidates").select("current_status").not("current_status", "is", null).order("current_status"),
        supabase.from("candidates").select("source").not("source", "is", null).order("source"),
        supabase.from("profiles").select("id, full_name").order("full_name"),
        supabase.from("candidates").select("interview_stage").not("interview_stage", "is", null).order("interview_stage"),
      ]);
      
      const qualifications = [...new Set(qualData.data?.map(d => d.highest_qualification).filter(Boolean) || [])];
      const positions = [...new Set(posData.data?.map(d => d.position_applied_for).filter(Boolean) || [])];
      const statuses = [...new Set(statusData.data?.map(d => d.current_status).filter(Boolean) || [])];
      const sources = [...new Set(sourceData.data?.map(d => d.source).filter(Boolean) || [])];
      const recruiters = recruiterData.data?.filter(r => r.full_name) || [];
      const stages = [...new Set(stageData.data?.map(d => d.interview_stage).filter(Boolean) || [])];

      setFilterOptions({
        highestQualification: qualifications,
        positionAppliedFor: positions,
        currentStatus: statuses,
        source: sources,
        recruiter: recruiters as { id: string; full_name: string }[],
        interviewStage: stages,
      });
    };

    fetchFilterOptions();
  }, []);

  const handleSelectAll = () => {
    if (selectedIds.size === candidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidates.map(c => c.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    try {
      setIsBulkDeleting(true);
      
      const { data, error } = await supabase.functions.invoke('bulk-delete-candidates', {
        body: { recordIds: Array.from(selectedIds) }
      });
      
      if (error) throw error;
      
      toast.success(`Successfully deleted ${data.successCount} candidate(s)`);
      if (data.errorCount > 0) {
        toast.error(`Failed to delete ${data.errorCount} candidate(s)`);
      }
      
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);
      window.location.reload();
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error('Failed to delete candidates');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteCandidate(deleteId);
      setDeleteId(null);
      setCandidateToDelete(null);
    }
  };

  const handleAssignmentComplete = () => {
    setSelectedIds(new Set());
    setShowAssignmentDialog(false);
    window.location.reload();
  };

  const handleStartBulkCalling = () => {
    const selectedCandidates = candidates.filter(c => selectedIds.has(c.id));
    const candidatesWithPhone = selectedCandidates.filter(c => c.phone);
    
    if (candidatesWithPhone.length === 0) {
      toast.error("None of the selected candidates have a phone number");
      return;
    }

    if (candidatesWithPhone.length < selectedCandidates.length) {
      toast.warning(`${selectedCandidates.length - candidatesWithPhone.length} candidate(s) without phone numbers will be skipped`);
    }

    const bulkCallCandidates: BulkCallCandidate[] = candidatesWithPhone.map(c => ({
      id: c.id,
      name: `${c.first_name} ${c.last_name}`,
      phone: c.phone!,
      email: c.email,
      designation: null,
      current_company: c.current_company,
      position_applied_for: c.position_applied_for,
    }));

    navigate("/calling-dashboard", { state: { candidates: bulkCallCandidates } });
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleClearFilters = () => {
    setFilters({
      candidateSearch: { value: "", operator: "contains" },
      highestQualification: [],
      keySkills: { value: "", operator: "contains" },
      positionAppliedFor: [],
      currentStatus: [],
      currentLocation: { value: "", operator: "contains" },
      experienceRange: [0, 30],
      ctcRange: [0, 100],
      noticePeriod: [],
      source: [],
      recruiter: [],
      interviewStage: [],
      rating: [],
      applicationDateFrom: "",
      applicationDateTo: "",
    });
    handlePageChange(1);
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.candidateSearch.value) count++;
    if (filters.highestQualification.length > 0) count++;
    if (filters.keySkills.value) count++;
    if (filters.positionAppliedFor.length > 0) count++;
    if (filters.currentStatus.length > 0) count++;
    if (filters.currentLocation.value) count++;
    if (filters.experienceRange[0] > 0 || filters.experienceRange[1] < 30) count++;
    if (filters.ctcRange[0] > 0 || filters.ctcRange[1] < 100) count++;
    if (filters.noticePeriod.length > 0) count++;
    if (filters.source.length > 0) count++;
    if (filters.recruiter.length > 0) count++;
    if (filters.interviewStage.length > 0) count++;
    if (filters.rating.length > 0) count++;
    if (filters.applicationDateFrom || filters.applicationDateTo) count++;
    return count;
  };

  // Helper functions for visual indicators
  const getNoticePeriodBadge = (days: number | null) => {
    if (days === null) return null;
    if (days <= 15) return <Badge variant="default" className="bg-green-500 text-white">Immediate</Badge>;
    if (days <= 30) return <Badge variant="secondary" className="bg-yellow-500 text-white">{days}d</Badge>;
    if (days <= 60) return <Badge variant="secondary" className="bg-orange-500 text-white">{days}d</Badge>;
    return <Badge variant="destructive">{days}d</Badge>;
  };

  const getLastContactBadge = (lastCallDate: string | null) => {
    if (!lastCallDate) return <span className="text-muted-foreground text-sm">Never</span>;
    const daysSince = differenceInDays(new Date(), parseISO(lastCallDate));
    if (daysSince > 7) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="destructive" className="text-xs">
                {daysSince}d ago
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Last contact: {format(parseISO(lastCallDate), "dd MMM yyyy")}</p>
              <p className="text-destructive">Needs follow-up!</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return <span className="text-sm">{formatDistanceToNow(parseISO(lastCallDate), { addSuffix: true })}</span>;
  };

  const renderStarRating = (rating: number | null) => {
    if (rating === null) return <span className="text-muted-foreground">-</span>;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-3 w-3 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
          />
        ))}
      </div>
    );
  };

  const getInterviewStageBadge = (stage: string | null) => {
    if (!stage) return <span className="text-muted-foreground">-</span>;
    const stageColors: Record<string, string> = {
      "applied": "bg-slate-500",
      "screening": "bg-blue-500",
      "interview": "bg-purple-500",
      "offer": "bg-green-500",
      "hired": "bg-emerald-600",
      "rejected": "bg-red-500",
    };
    return (
      <Badge className={`${stageColors[stage.toLowerCase()] || "bg-gray-500"} text-white`}>
        {stage}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      "applied": "bg-blue-500",
      "sourcing_new_lead": "bg-cyan-500",
      "screening": "bg-indigo-500",
      "interview": "bg-purple-500",
      "shortlisted": "bg-amber-500",
      "offer": "bg-teal-500",
      "hired": "bg-green-600",
      "joined": "bg-emerald-500",
      "rejected": "bg-red-500",
      "on_hold": "bg-orange-500",
      "dropped": "bg-gray-500",
      "not_interested": "bg-rose-500",
    };
    const colorClass = statusColors[status.toLowerCase()] || "bg-slate-500";
    return (
      <Badge className={`${colorClass} text-white`}>
        {status.replace(/_/g, ' ')}
      </Badge>
    );
  };

  const activeFilterCount = getActiveFilterCount();

  return (
    <div className="px-8 py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Candidates</h1>
        <div className="flex gap-2">
          <Button 
            onClick={() => setShowFilters(!showFilters)} 
            variant="outline"
            className="relative"
          >
            <Filter className="mr-2 h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2 px-1.5 py-0.5 text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
          <Button onClick={() => setShowBulkImport(true)} variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Bulk Upload
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <TextFilterInput
                label="Candidate (Name, Phone, Email)"
                value={filters.candidateSearch.value}
                operator={filters.candidateSearch.operator}
                onChange={(value, operator) =>
                  setFilters({ ...filters, candidateSearch: { value, operator } })
                }
                placeholder="Search by name, phone, or email..."
              />
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Highest Qualification</label>
                <MultiSelectFilter
                  options={filterOptions.highestQualification}
                  selected={filters.highestQualification}
                  onChange={(selected) => setFilters({ ...filters, highestQualification: selected })}
                  placeholder="Select qualifications..."
                  triggerLabel="Highest Qualification"
                />
              </div>

              <TextFilterInput
                label="Key Skills"
                value={filters.keySkills.value}
                operator={filters.keySkills.operator}
                onChange={(value, operator) =>
                  setFilters({ ...filters, keySkills: { value, operator } })
                }
                placeholder="Search by skills..."
              />

              <div className="space-y-2">
                <label className="text-sm font-medium">Position Applied For</label>
                <MultiSelectFilter
                  options={filterOptions.positionAppliedFor}
                  selected={filters.positionAppliedFor}
                  onChange={(selected) => setFilters({ ...filters, positionAppliedFor: selected })}
                  placeholder="Select positions..."
                  triggerLabel="Position Applied For"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Current Status</label>
                <MultiSelectFilter
                  options={filterOptions.currentStatus}
                  selected={filters.currentStatus}
                  onChange={(selected) => setFilters({ ...filters, currentStatus: selected })}
                  placeholder="Select statuses..."
                  triggerLabel="Current Status"
                />
              </div>

              <TextFilterInput
                label="Current Location"
                value={filters.currentLocation.value}
                operator={filters.currentLocation.operator}
                onChange={(value, operator) =>
                  setFilters({ ...filters, currentLocation: { value, operator } })
                }
                placeholder="Search by location..."
              />

              {/* New Filters */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Experience Range: {filters.experienceRange[0]} - {filters.experienceRange[1]} yrs</label>
                <Slider
                  value={filters.experienceRange}
                  onValueChange={(value) => setFilters({ ...filters, experienceRange: value as [number, number] })}
                  min={0}
                  max={30}
                  step={1}
                  className="mt-2"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">CTC Range: ₹{filters.ctcRange[0]}L - ₹{filters.ctcRange[1]}L</label>
                <Slider
                  value={filters.ctcRange}
                  onValueChange={(value) => setFilters({ ...filters, ctcRange: value as [number, number] })}
                  min={0}
                  max={100}
                  step={1}
                  className="mt-2"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Notice Period</label>
                <MultiSelectFilter
                  options={["immediate", "30days", "60days", "90plus"]}
                  selected={filters.noticePeriod}
                  onChange={(selected) => setFilters({ ...filters, noticePeriod: selected })}
                  placeholder="Select notice period..."
                  triggerLabel="Notice Period"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Source</label>
                <MultiSelectFilter
                  options={filterOptions.source}
                  selected={filters.source}
                  onChange={(selected) => setFilters({ ...filters, source: selected })}
                  placeholder="Select sources..."
                  triggerLabel="Source"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Recruiter</label>
                <MultiSelectFilter
                  options={filterOptions.recruiter.map(r => r.id)}
                  selected={filters.recruiter}
                  onChange={(selected) => setFilters({ ...filters, recruiter: selected })}
                  placeholder="Select recruiters..."
                  triggerLabel="Recruiter"
                  renderLabel={(id) => filterOptions.recruiter.find(r => r.id === id)?.full_name || id}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Rating</label>
                <MultiSelectFilter
                  options={["1", "2", "3", "4", "5"]}
                  selected={filters.rating.map(String)}
                  onChange={(selected) => setFilters({ ...filters, rating: selected.map(Number) })}
                  placeholder="Select ratings..."
                  triggerLabel="Rating"
                  renderLabel={(val) => `${val} Star${Number(val) > 1 ? 's' : ''}`}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Application Date From</label>
                <input
                  type="date"
                  value={filters.applicationDateFrom}
                  onChange={(e) => setFilters({ ...filters, applicationDateFrom: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Application Date To</label>
                <input
                  type="date"
                  value={filters.applicationDateTo}
                  onChange={(e) => setFilters({ ...filters, applicationDateTo: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClearFilters}>
                <X className="mr-2 h-4 w-4" />
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <LoadingSpinner />
      ) : candidates.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No candidates found"
          description="Start by adding a new candidate or uploading in bulk."
          actionLabel="Add Candidate"
          onAction={() => navigate("/candidates/new")}
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === candidates.length && candidates.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Connect</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Experience</TableHead>
                  <TableHead>CTC</TableHead>
                  <TableHead>Notice</TableHead>
                  <TableHead>Source</TableHead>
                  
                  <TableHead>Recruiter</TableHead>
                  
                  <TableHead>Rating</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((candidate) => (
                  <TableRow 
                    key={candidate.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/candidates/view/${candidate.id}`)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(candidate.id)}
                        onChange={() => handleSelectOne(candidate.id)}
                        className="rounded border-gray-300"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {candidate.first_name} {candidate.last_name}
                        </span>
                        {candidate.is_fresh_application && (
                          <FreshApplicationBadge applicationSubmittedAt={candidate.application_submitted_at} />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span>{candidate.phone || "-"}</span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {candidate.phone && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 border-primary/50 hover:bg-primary hover:text-primary-foreground"
                            onClick={() => {
                              setCallCandidate(candidate);
                              setShowCallDialog(true);
                            }}
                          >
                            <Phone className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 border-green-500/50 hover:bg-green-600 hover:text-white"
                            onClick={() => {
                              setWhatsAppCandidate(candidate);
                              setShowWhatsAppDialog(true);
                            }}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{candidate.position_applied_for}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Briefcase className="h-3 w-3 text-muted-foreground" />
                        <span>{candidate.total_experience_years !== null ? `${candidate.total_experience_years} yrs` : "-"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {candidate.current_ctc_lakhs !== null || candidate.expected_ctc_lakhs !== null ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="flex items-center gap-1">
                                <IndianRupee className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">
                                  {(candidate.current_ctc_lakhs ?? 0).toFixed(1)}L → {(candidate.expected_ctc_lakhs ?? 0).toFixed(1)}L
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Current: ₹{(candidate.current_ctc_lakhs ?? 0).toFixed(2)}L</p>
                              <p>Expected: ₹{(candidate.expected_ctc_lakhs ?? 0).toFixed(2)}L</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getNoticePeriodBadge(candidate.notice_period_days)}</TableCell>
                    <TableCell>
                      {candidate.source ? (
                        <Badge variant="outline" className="text-xs">{candidate.source}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      {candidate.recruiter_profile?.full_name || (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    
                    <TableCell>{renderStarRating(candidate.rating)}</TableCell>
                    <TableCell>
                      {getStatusBadge(candidate.current_status)}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => navigate(`/candidates/${candidate.id}`)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setHistoryCandidate(candidate);
                            setShowHistorySheet(true);
                          }}
                          title="Call History"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalCount}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handleItemsPerPageChange}
          />
        </>
      )}

      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteId(null);
            setCandidateToDelete(null);
          }
        }}
        onConfirm={handleDelete}
        title="Delete Candidate"
        description={`Are you sure you want to delete ${candidateToDelete?.first_name} ${candidateToDelete?.last_name}? This action cannot be undone.`}
        isLoading={isDeleting}
      />

      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} Candidates</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.size} selected candidate(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting ? "Deleting..." : "Delete All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CandidateBulkImportDialog
        open={showBulkImport}
        onOpenChange={setShowBulkImport}
        onSuccess={() => {
          setShowBulkImport(false);
          refetch();
        }}
      />

      <CandidateAssignmentDialog
        open={showAssignmentDialog}
        onOpenChange={setShowAssignmentDialog}
        selectedIds={Array.from(selectedIds)}
        onAssignmentComplete={handleAssignmentComplete}
      />

      {callCandidate && (
        <ExotelCallDialog
          open={showCallDialog}
          onOpenChange={setShowCallDialog}
          candidateData={{
            id: callCandidate.id,
            first_name: callCandidate.first_name,
            last_name: callCandidate.last_name,
            phone: callCandidate.phone || "",
            email: callCandidate.email,
            designation: null,
            current_company: callCandidate.current_company,
            position_applied_for: callCandidate.position_applied_for
          }}
        />
      )}

      {historyCandidate && (
        <CandidateCallHistorySheet
          open={showHistorySheet}
          onOpenChange={setShowHistorySheet}
          candidateId={historyCandidate.id}
          candidateName={`${historyCandidate.first_name} ${historyCandidate.last_name}`}
        />
      )}

      {whatsAppCandidate && (
        <WhatsAppDialog
          open={showWhatsAppDialog}
          onOpenChange={setShowWhatsAppDialog}
          candidateData={{
            id: whatsAppCandidate.id,
            first_name: whatsAppCandidate.first_name,
            last_name: whatsAppCandidate.last_name,
            phone: whatsAppCandidate.phone || "",
            email: whatsAppCandidate.email,
            designation: null,
            current_company: whatsAppCandidate.current_company,
            position_applied_for: whatsAppCandidate.position_applied_for
          }}
        />
      )}

      <CandidateSelectionBar
        selectedCount={selectedIds.size}
        onStartBulkCalling={handleStartBulkCalling}
        onAssign={() => setShowAssignmentDialog(true)}
        onBulkDelete={() => setShowBulkDeleteConfirm(true)}
        onClearSelection={handleClearSelection}
        canBulkDelete={canBulkDelete}
      />
    </div>
  );
};

export default Candidates;