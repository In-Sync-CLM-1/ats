import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Eye, Pencil, Upload, MapPin, Clock, Users, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, DataTableColumn } from "@/components/data-table/DataTable";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { useCrudMutation } from "@/hooks/useCrudMutation";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MandateBulkImportDialog } from "@/components/MandateBulkImportDialog";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { differenceInDays, format } from "date-fns";
import { useQuery } from "@tanstack/react-query";

interface Mandate {
  id: string;
  job_title: string;
  mandate_status: string;
  priority_level: string;
  client_id: string | null;
  clients?: {
    company_name: string;
  } | null;
  assigned_recruiter_id: string | null;
  assigned_recruiter?: {
    full_name: string;
  } | null;
  secondary_recruiter_id: string | null;
  secondary_recruiter?: {
    full_name: string;
  } | null;
  created_at: string;
  number_of_positions: number;
  positions_filled: number;
  profiles_submitted: number;
  profiles_shortlisted: number;
  profiles_selected: number;
  job_location: string;
  work_mode: string;
  employment_type: string;
  min_ctc_lakhs: number;
  max_ctc_lakhs: number;
  target_closure_date: string;
  mandate_received_date: string;
}

interface Recruiter {
  id: string;
  full_name: string | null;
}

export default function Mandates() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [recruiterFilter, setRecruiterFilter] = useState<string>("all");
  const [workModeFilter, setWorkModeFilter] = useState<string>("all");
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  // Fetch recruiters for filter dropdown
  const { data: recruiters = [] } = useQuery({
    queryKey: ["recruiters-for-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");
      if (error) throw error;
      return data as Recruiter[];
    },
  });

  const {
    data: mandates,
    totalCount,
    totalPages,
    currentPage,
    itemsPerPage,
    isLoading,
    handlePageChange,
    handleItemsPerPageChange,
    refetch,
  } = usePaginatedQuery<Mandate>({
    queryKey: ["mandates", search, statusFilter, priorityFilter, recruiterFilter, workModeFilter, employmentTypeFilter],
    queryFn: async (from, to) => {
      let query = supabase
        .from("mandates")
        .select(`
          id,
          job_title,
          mandate_status,
          priority_level,
          client_id,
          clients(company_name),
          assigned_recruiter_id,
          assigned_recruiter:profiles!fk_projects_assigned_recruiter(full_name),
          secondary_recruiter_id,
          secondary_recruiter:profiles!fk_projects_secondary_recruiter(full_name),
          created_at,
          number_of_positions,
          positions_filled,
          profiles_submitted,
          profiles_shortlisted,
          profiles_selected,
          job_location,
          work_mode,
          employment_type,
          min_ctc_lakhs,
          max_ctc_lakhs,
          target_closure_date,
          mandate_received_date
        `, { count: "exact" });

      if (search) {
        query = query.or(`job_title.ilike.%${search}%,job_location.ilike.%${search}%`);
      }
      if (statusFilter !== "all") {
        query = query.eq("mandate_status", statusFilter);
      }
      if (priorityFilter !== "all") {
        query = query.eq("priority_level", priorityFilter);
      }
      if (recruiterFilter !== "all") {
        query = query.or(`assigned_recruiter_id.eq.${recruiterFilter},secondary_recruiter_id.eq.${recruiterFilter}`);
      }
      if (workModeFilter !== "all") {
        query = query.eq("work_mode", workModeFilter);
      }
      if (employmentTypeFilter !== "all") {
        query = query.eq("employment_type", employmentTypeFilter);
      }

      query = query.order("created_at", { ascending: false }).range(from, to);

      const { data, error, count } = await query;
      return { data: data as Mandate[] | null, count, error };
    },
  });

  const { delete: deleteMandate, isDeleting } = useCrudMutation<Mandate>({
    queryKey: ["mandates"],
    createFn: async (data) => {
      const { data: result, error } = await supabase.from("mandates").insert(data).select().single();
      if (error) throw error;
      return result as Mandate;
    },
    updateFn: async (id, data) => {
      const { data: result, error } = await supabase.from("mandates").update(data).eq("id", id).select().single();
      if (error) throw error;
      return result as Mandate;
    },
    deleteFn: async (id) => {
      const { error } = await supabase.from("mandates").delete().eq("id", id);
      if (error) throw error;
    },
    successMessages: { delete: "Mandate deleted successfully" },
    errorMessages: { delete: "Failed to delete mandate" },
  });

  const handleDelete = async () => {
    if (selectedItem) {
      await deleteMandate(selectedItem);
      setDeleteDialogOpen(false);
      setSelectedItem(null);
    }
  };

  const getUrgencyBadge = (targetDate: string) => {
    if (!targetDate) return null;
    const daysRemaining = differenceInDays(new Date(targetDate), new Date());
    
    if (daysRemaining < 0) {
      return <Badge variant="destructive" className="text-xs">Overdue</Badge>;
    } else if (daysRemaining <= 7) {
      return <Badge variant="destructive" className="text-xs">{daysRemaining}d left</Badge>;
    } else if (daysRemaining <= 14) {
      return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-xs">{daysRemaining}d left</Badge>;
    } else {
      return <Badge variant="secondary" className="text-xs">{daysRemaining}d left</Badge>;
    }
  };

  const getWorkModeBadge = (workMode: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      "remote": "default",
      "hybrid": "secondary",
      "on-site": "outline",
    };
    return <Badge variant={variants[workMode] || "outline"} className="text-xs capitalize">{workMode || "-"}</Badge>;
  };

  const columns: DataTableColumn<Mandate>[] = [
    {
      header: "Job Title",
      accessorKey: "job_title",
      cell: (row) => (
        <div className="min-w-[150px]">
          <span className="font-medium block">{row.job_title}</span>
          <span className="text-xs text-muted-foreground">{row.clients?.company_name || "-"}</span>
        </div>
      ),
    },
    {
      header: "Positions",
      accessorKey: "number_of_positions",
      cell: (row) => {
        const filled = row.positions_filled || 0;
        const total = row.number_of_positions || 1;
        const percentage = Math.min((filled / total) * 100, 100);
        
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="min-w-[80px]">
                  <div className="flex items-center gap-1 text-sm font-medium">
                    <Users className="h-3 w-3" />
                    <span>{filled}/{total}</span>
                  </div>
                  <Progress value={percentage} className="h-1.5 mt-1" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Submitted: {row.profiles_submitted || 0}</p>
                <p>Shortlisted: {row.profiles_shortlisted || 0}</p>
                <p>Selected: {row.profiles_selected || 0}</p>
                <p>Filled: {filled}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
    {
      header: "Location",
      accessorKey: "job_location",
      cell: (row) => (
        <div className="flex items-center gap-1 text-sm">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          <span className="truncate max-w-[120px]">{row.job_location || "-"}</span>
        </div>
      ),
    },
    {
      header: "Work Mode",
      accessorKey: "work_mode",
      cell: (row) => getWorkModeBadge(row.work_mode),
    },
    {
      header: "CTC Range",
      accessorKey: "min_ctc_lakhs",
      cell: (row) => (
        <span className="text-sm whitespace-nowrap">
          {row.min_ctc_lakhs && row.max_ctc_lakhs 
            ? `₹${row.min_ctc_lakhs}L - ₹${row.max_ctc_lakhs}L` 
            : "-"}
        </span>
      ),
    },
    {
      header: "Target Date",
      accessorKey: "target_closure_date",
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1 text-sm">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span>{row.target_closure_date ? format(new Date(row.target_closure_date), "dd MMM") : "-"}</span>
          </div>
          {row.target_closure_date && getUrgencyBadge(row.target_closure_date)}
        </div>
      ),
    },
    {
      header: "Recruiter",
      accessorKey: "assigned_recruiter",
      cell: (row) => (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-sm">
                <span className="block truncate max-w-[100px]">
                  {row.assigned_recruiter?.full_name || "-"}
                </span>
                {row.secondary_recruiter?.full_name && (
                  <span className="text-xs text-muted-foreground truncate block max-w-[100px]">
                    +{row.secondary_recruiter.full_name}
                  </span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Primary: {row.assigned_recruiter?.full_name || "Not assigned"}</p>
              {row.secondary_recruiter?.full_name && (
                <p>Secondary: {row.secondary_recruiter.full_name}</p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
    },
    {
      header: "Status",
      accessorKey: "mandate_status",
      cell: (row) => {
        const variant = row.mandate_status === "open" ? "default" : 
                       row.mandate_status === "closed" ? "secondary" : "outline";
        return <Badge variant={variant} className="capitalize">{row.mandate_status}</Badge>;
      },
    },
    {
      header: "Priority",
      accessorKey: "priority_level",
      cell: (row) => {
        const variant = row.priority_level === "high" ? "destructive" : 
                       row.priority_level === "medium" ? "secondary" : "outline";
        return <Badge variant={variant} className="capitalize">{row.priority_level}</Badge>;
      },
    },
  ];

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setRecruiterFilter("all");
    setWorkModeFilter("all");
    setEmploymentTypeFilter("all");
  };

  const hasActiveFilters = search || statusFilter !== "all" || priorityFilter !== "all" || 
    recruiterFilter !== "all" || workModeFilter !== "all" || employmentTypeFilter !== "all";

  return (
    <div className="px-8 py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Mandates</h1>
        <div className="flex gap-2">
          <Button onClick={() => setBulkImportOpen(true)} variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Bulk Upload
          </Button>
          <Button onClick={() => navigate("/mandates/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Add Mandate
          </Button>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <Input
          placeholder="Search job title, location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="on-hold">On Hold</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={recruiterFilter} onValueChange={setRecruiterFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Recruiter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Recruiters</SelectItem>
            {recruiters.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.full_name || "Unknown"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={workModeFilter} onValueChange={setWorkModeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Work Mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modes</SelectItem>
            <SelectItem value="remote">Remote</SelectItem>
            <SelectItem value="hybrid">Hybrid</SelectItem>
            <SelectItem value="on-site">On-site</SelectItem>
          </SelectContent>
        </Select>
        <Select value={employmentTypeFilter} onValueChange={setEmploymentTypeFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Employment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="full-time">Full-time</SelectItem>
            <SelectItem value="contract">Contract</SelectItem>
            <SelectItem value="part-time">Part-time</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      <DataTable
        data={mandates}
        columns={columns}
        getRowKey={(row) => row.id}
        isLoading={isLoading}
        emptyState={{ title: "No mandates found" }}
        actions={(row) => (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/mandates/view/${row.id}`)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/mandates/edit/${row.id}`)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        )}
        pagination={{
          currentPage,
          totalPages,
          totalItems: totalCount,
          itemsPerPage,
          onPageChange: handlePageChange,
          onItemsPerPageChange: handleItemsPerPageChange,
        }}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Delete Mandate"
        description="Are you sure you want to delete this mandate? This action cannot be undone."
      />

      <MandateBulkImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        onSuccess={() => {
          setBulkImportOpen(false);
          refetch();
        }}
      />
    </div>
  );
}
