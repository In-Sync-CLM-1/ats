import { supabase } from "@/integrations/supabase/client";

type DataSource = "clients" | "candidates" | "mandates";

interface TextFilter {
  value: string;
  operator: "contains" | "equals" | "starts_with";
}

interface DateRangeFilter {
  from: Date | null;
  to: Date | null;
}

interface FilterState {
  // ATS fields
  firstName: TextFilter;
  lastName: TextFilter;
  phone: TextFilter;
  email: TextFilter;
  linkedinUrl: TextFilter;
  positionAppliedFor: string[];
  currentStatus: string[];
  interviewStage: string[];
  currentCompany: TextFilter;
  designation: string[];
  location: TextFilter;
  address: TextFilter;
  city: string[];
  state: string[];
  country: string[];
  pincode: TextFilter;
  source: string[];
  recruitmentStatus: string[];
  disposition: string[];
  subdisposition: string[];
  // Client fields
  company: TextFilter;
  contactName: TextFilter;
  // Mandate fields
  jobTitle: TextFilter;
  mandateStatus: string[];
  // Date filters
  applicationDate: DateRangeFilter;
  createdDate: DateRangeFilter;
  updatedDate: DateRangeFilter;
  lastCallDate: DateRangeFilter;
  nextCallDate: DateRangeFilter;
  assignedDate: DateRangeFilter;
  birthdayDate: DateRangeFilter;
  anniversaryDate: DateRangeFilter;
}

export async function buildAdvancedFilterQuery(
  source: DataSource,
  filters: FilterState,
  from: number,
  to: number
) {
  let query;

  // Initialize query based on source
  switch (source) {
    case "clients":
      query = supabase.from("clients").select("*", { count: "exact" });
      break;
    case "candidates":
      query = supabase.from("candidates").select("*", { count: "exact" });
      break;
    case "mandates":
      query = supabase.from("mandates").select("*, clients(company_name)", { count: "exact" });
      break;
    default:
      return { data: null, count: 0, error: { message: "Invalid source" } };
  }

  // Apply text filters for ATS fields
  if (filters.firstName.value && source === "candidates") {
    query = applyTextFilter(query, "first_name", filters.firstName);
  }

  if (filters.lastName.value && source === "candidates") {
    query = applyTextFilter(query, "last_name", filters.lastName);
  }

  if (filters.phone.value) {
    const field = source === "clients" ? "contact_number" : "phone";
    query = applyTextFilter(query, field, filters.phone);
  }

  if (filters.email.value) {
    const field = source === "clients" ? "email_id" : "email";
    query = applyTextFilter(query, field, filters.email);
  }

  // Client-specific filters
  if (filters.company.value && source === "clients") {
    query = applyTextFilter(query, "company_name", filters.company);
  }

  if (filters.contactName.value && source === "clients") {
    query = applyTextFilter(query, "contact_name", filters.contactName);
  }

  // Mandate-specific filters
  if (filters.jobTitle.value && source === "mandates") {
    query = applyTextFilter(query, "job_title", filters.jobTitle);
  }

  // ATS text filters
  if (filters.linkedinUrl.value && source === "candidates") {
    query = applyTextFilter(query, "linkedin_url", filters.linkedinUrl);
  }

  if (filters.currentCompany.value && source === "candidates") {
    query = applyTextFilter(query, "current_company", filters.currentCompany);
  }

  if (filters.location.value && source === "candidates") {
    query = applyTextFilter(query, "location", filters.location);
  }

  if (filters.address.value && source === "candidates") {
    query = applyTextFilter(query, "address", filters.address);
  }

  if (filters.pincode.value && source === "candidates") {
    query = applyTextFilter(query, "pincode", filters.pincode);
  }

  // ATS multi-select filters
  if (filters.positionAppliedFor.length > 0 && source === "candidates") {
    query = query.in("position_applied_for", filters.positionAppliedFor);
  }

  if (filters.currentStatus.length > 0 && source === "candidates") {
    query = query.in("current_status", filters.currentStatus);
  }

  if (filters.interviewStage.length > 0 && source === "candidates") {
    query = query.in("interview_stage", filters.interviewStage);
  }

  if (filters.designation.length > 0 && source === "candidates") {
    query = query.in("designation", filters.designation);
  }

  if (filters.recruitmentStatus.length > 0 && source === "candidates") {
    query = query.in("recruitment_status", filters.recruitmentStatus);
  }

  // Location filters
  if (filters.city.length > 0) {
    query = query.in("city", filters.city);
  }

  if (filters.state.length > 0) {
    query = query.in("state", filters.state);
  }

  if (filters.country.length > 0 && source === "candidates") {
    query = query.in("country", filters.country);
  }

  // Disposition filters
  if (filters.disposition.length > 0 && source === "candidates") {
    if (filters.disposition.length >= 10) {
      const quotedValues = filters.disposition.map(d => `"${d}"`).join(',');
      query = query.or(`latest_disposition.in.(${quotedValues}),latest_disposition.is.null`);
    } else {
      query = query.in("latest_disposition", filters.disposition);
    }
  }

  if (filters.subdisposition.length > 0 && source === "candidates") {
    if (filters.subdisposition.length >= 20) {
      const quotedValues = filters.subdisposition.map(s => `"${s}"`).join(',');
      query = query.or(`latest_subdisposition.in.(${quotedValues}),latest_subdisposition.is.null`);
    } else {
      query = query.in("latest_subdisposition", filters.subdisposition);
    }
  }

  if (filters.source.length > 0 && source === "candidates") {
    query = query.in("source", filters.source);
  }

  if (filters.mandateStatus.length > 0 && source === "mandates") {
    query = query.in("mandate_status", filters.mandateStatus);
  }

  // Apply date range filters
  if (source === "candidates" && (filters.applicationDate.from || filters.applicationDate.to)) {
    if (filters.applicationDate.from) {
      query = query.gte("application_date", filters.applicationDate.from.toISOString());
    }
    if (filters.applicationDate.to) {
      query = query.lte("application_date", filters.applicationDate.to.toISOString());
    }
  }

  if (filters.createdDate.from || filters.createdDate.to) {
    if (filters.createdDate.from) {
      query = query.gte("created_at", filters.createdDate.from.toISOString());
    }
    if (filters.createdDate.to) {
      query = query.lte("created_at", filters.createdDate.to.toISOString());
    }
  }

  if (source === "candidates" && (filters.lastCallDate.from || filters.lastCallDate.to)) {
    if (filters.lastCallDate.from) {
      query = query.gte("last_call_date", filters.lastCallDate.from.toISOString());
    }
    if (filters.lastCallDate.to) {
      query = query.lte("last_call_date", filters.lastCallDate.to.toISOString());
    }
  }

  if (source === "candidates" && (filters.nextCallDate.from || filters.nextCallDate.to)) {
    if (filters.nextCallDate.from) {
      query = query.gte("next_call_date", filters.nextCallDate.from.toISOString());
    }
    if (filters.nextCallDate.to) {
      query = query.lte("next_call_date", filters.nextCallDate.to.toISOString());
    }
  }

  if (source === "candidates" && (filters.updatedDate.from || filters.updatedDate.to)) {
    if (filters.updatedDate.from) {
      query = query.gte("updated_at", filters.updatedDate.from.toISOString());
    }
    if (filters.updatedDate.to) {
      query = query.lte("updated_at", filters.updatedDate.to.toISOString());
    }
  }

  if (source === "candidates" && (filters.assignedDate.from || filters.assignedDate.to)) {
    if (filters.assignedDate.from) {
      query = query.gte("assigned_at", filters.assignedDate.from.toISOString());
    }
    if (filters.assignedDate.to) {
      query = query.lte("assigned_at", filters.assignedDate.to.toISOString());
    }
  }

  // Apply pagination
  query = query.range(from, to);

  const result = await query;
  return result;
}

function applyTextFilter(query: any, field: string, filter: TextFilter) {
  const { value, operator } = filter;
  
  if (operator === "contains") {
    return query.ilike(field, `%${value}%`);
  } else if (operator === "equals") {
    return query.eq(field, value);
  } else if (operator === "starts_with") {
    return query.ilike(field, `${value}%`);
  }
  
  return query;
}