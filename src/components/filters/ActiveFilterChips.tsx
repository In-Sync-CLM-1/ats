import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { format } from "date-fns";

interface TextFilter {
  value: string;
  operator: "contains" | "equals" | "starts_with";
}

interface DateRangeFilter {
  from: Date | null;
  to: Date | null;
}

interface FilterState {
  firstName: TextFilter;
  lastName: TextFilter;
  phone: TextFilter;
  email: TextFilter;
  company: TextFilter;
  contactName: TextFilter;
  jobTitle: TextFilter;
  linkedinUrl: TextFilter;
  positionAppliedFor: string[];
  currentCompany: TextFilter;
  location: TextFilter;
  address: TextFilter;
  pincode: TextFilter;
  currentStatus: string[];
  interviewStage: string[];
  city: string[];
  state: string[];
  designation: string[];
  disposition: string[];
  subdisposition: string[];
  source: string[];
  country: string[];
  recruitmentStatus: string[];
  mandateStatus: string[];
  createdDate: DateRangeFilter;
  updatedDate: DateRangeFilter;
  lastCallDate: DateRangeFilter;
  nextCallDate: DateRangeFilter;
  assignedDate: DateRangeFilter;
  applicationDate: DateRangeFilter;
  birthdayDate: DateRangeFilter;
  anniversaryDate: DateRangeFilter;
}

interface ActiveFilterChipsProps {
  filters: FilterState;
  onRemoveFilter: (filterKey: keyof FilterState) => void;
  onClearAll: () => void;
}

export function ActiveFilterChips({ filters, onRemoveFilter, onClearAll }: ActiveFilterChipsProps) {
  const activeFilters: Array<{ key: keyof FilterState; label: string; value: string }> = [];

  // Text filters
  const textFilters: Array<{ key: keyof FilterState; label: string; filter: TextFilter }> = [
    { key: "firstName", label: "First Name", filter: filters.firstName },
    { key: "lastName", label: "Last Name", filter: filters.lastName },
    { key: "phone", label: "Phone", filter: filters.phone },
    { key: "email", label: "Email", filter: filters.email },
    { key: "company", label: "Company", filter: filters.company },
    { key: "contactName", label: "Contact Name", filter: filters.contactName },
    { key: "jobTitle", label: "Job Title", filter: filters.jobTitle },
    { key: "linkedinUrl", label: "LinkedIn", filter: filters.linkedinUrl },
    { key: "currentCompany", label: "Current Company", filter: filters.currentCompany },
    { key: "location", label: "Location", filter: filters.location },
    { key: "address", label: "Address", filter: filters.address },
    { key: "pincode", label: "Pincode", filter: filters.pincode },
  ];

  textFilters.forEach(({ key, label, filter }) => {
    if (filter.value) {
      const operatorLabel = filter.operator === "contains" ? "contains" : filter.operator === "equals" ? "equals" : "starts with";
      activeFilters.push({
        key,
        label,
        value: `${operatorLabel} "${filter.value}"`,
      });
    }
  });

  // Multi-select filters
  const multiSelectFilters: Array<{ key: keyof FilterState; label: string; values: string[] }> = [
    { key: "positionAppliedFor", label: "Position", values: filters.positionAppliedFor },
    { key: "currentStatus", label: "Status", values: filters.currentStatus },
    { key: "interviewStage", label: "Interview Stage", values: filters.interviewStage },
    { key: "city", label: "City", values: filters.city },
    { key: "state", label: "State", values: filters.state },
    { key: "country", label: "Country", values: filters.country },
    { key: "designation", label: "Designation", values: filters.designation },
    { key: "recruitmentStatus", label: "Recruitment Status", values: filters.recruitmentStatus },
    { key: "disposition", label: "Disposition", values: filters.disposition },
    { key: "subdisposition", label: "Sub Disposition", values: filters.subdisposition },
    { key: "source", label: "Source", values: filters.source },
    { key: "mandateStatus", label: "Mandate Status", values: filters.mandateStatus },
  ];

  multiSelectFilters.forEach(({ key, label, values }) => {
    if (values.length > 0) {
      const displayValue = values.length > 2 
        ? `${values.slice(0, 2).join(", ")} (+${values.length - 2} more)`
        : values.join(", ");
      activeFilters.push({
        key,
        label,
        value: displayValue,
      });
    }
  });

  // Date range filters
  const dateFilters: Array<{ key: keyof FilterState; label: string; filter: DateRangeFilter }> = [
    { key: "applicationDate", label: "Application Date", filter: filters.applicationDate },
    { key: "createdDate", label: "Created Date", filter: filters.createdDate },
    { key: "updatedDate", label: "Updated Date", filter: filters.updatedDate },
    { key: "lastCallDate", label: "Last Call", filter: filters.lastCallDate },
    { key: "nextCallDate", label: "Next Call", filter: filters.nextCallDate },
    { key: "assignedDate", label: "Assigned Date", filter: filters.assignedDate },
    { key: "birthdayDate", label: "Birthday", filter: filters.birthdayDate },
    { key: "anniversaryDate", label: "Anniversary", filter: filters.anniversaryDate },
  ];

  dateFilters.forEach(({ key, label, filter }) => {
    if (filter.from || filter.to) {
      let value = "";
      if (filter.from && filter.to) {
        value = `${format(filter.from, "MMM dd, yyyy")} - ${format(filter.to, "MMM dd, yyyy")}`;
      } else if (filter.from) {
        value = `From ${format(filter.from, "MMM dd, yyyy")}`;
      } else if (filter.to) {
        value = `Until ${format(filter.to, "MMM dd, yyyy")}`;
      }
      activeFilters.push({
        key,
        label,
        value,
      });
    }
  });

  if (activeFilters.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 p-4 bg-muted/30 rounded-lg border">
      <span className="text-sm font-medium text-muted-foreground">Active Filters:</span>
      {activeFilters.map(({ key, label, value }) => (
        <Badge key={key} variant="secondary" className="gap-1 px-3 py-1">
          <span className="font-medium">{label}:</span>
          <span className="text-muted-foreground">{value}</span>
          <button
            onClick={() => onRemoveFilter(key)}
            className="ml-1 hover:text-destructive transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearAll}
        className="ml-auto text-muted-foreground hover:text-foreground"
      >
        Clear All
      </Button>
    </div>
  );
}
