import React from "react";
import { DataTableColumn } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

type DataSource = "clients" | "candidates" | "mandates";

export function getColumnsForSource<T = any>(source: DataSource): DataTableColumn<T>[] {
  switch (source) {
    case "clients":
      return [
        {
          header: "Company Name",
          accessorKey: "company_name",
          cell: (row: any) => (
            <span className="max-w-[200px] truncate block font-medium">{row.company_name}</span>
          ),
        },
        {
          header: "Industry",
          accessorKey: "industry_sector",
        },
        {
          header: "Contact Person",
          accessorKey: "contact_name",
        },
        {
          header: "Designation",
          accessorKey: "contact_person_designation",
        },
        {
          header: "Status",
          accessorKey: "client_status",
          cell: (row: any) => {
            const statusColors: Record<string, string> = {
              active: "bg-green-100 text-green-800 border-green-200",
              inactive: "bg-gray-100 text-gray-800 border-gray-200",
              on_hold: "bg-yellow-100 text-yellow-800 border-yellow-200"
            };
            return row.client_status ? (
              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${statusColors[row.client_status] || statusColors.inactive}`}>
                {row.client_status.replace('_', ' ').toUpperCase()}
              </span>
            ) : "-";
          }
        },
        {
          header: "Email",
          accessorKey: "email_id",
        },
        {
          header: "Phone",
          accessorKey: "contact_number",
        },
        {
          header: "Last Interaction",
          accessorKey: "last_interaction_date",
          cell: (row: any) => row.last_interaction_date ? format(new Date(row.last_interaction_date), "MMM dd, yyyy") : "-"
        },
      ] as DataTableColumn<T>[];

    case "candidates":
      return [
        {
          header: "First Name",
          accessorKey: "first_name",
        },
        {
          header: "Last Name",
          accessorKey: "last_name",
        },
        {
          header: "Phone",
          accessorKey: "phone",
        },
        {
          header: "Position",
          accessorKey: "position_applied_for",
          cell: (row: any) => (
            <span className="max-w-[200px] truncate block">{row.position_applied_for || "-"}</span>
          ),
        },
        {
          header: "Status",
          accessorKey: "current_status",
          cell: (row: any) => (
            <Badge variant={row.current_status === "hired" ? "default" : "secondary"}>
              {row.current_status || "applied"}
            </Badge>
          ),
        },
        {
          header: "Interview Stage",
          accessorKey: "interview_stage",
          cell: (row: any) => row.interview_stage ? <Badge variant="outline">{row.interview_stage}</Badge> : "-",
        },
        {
          header: "City",
          accessorKey: "city",
        },
        {
          header: "Latest Disposition",
          accessorKey: "latest_disposition",
          cell: (row: any) => (
            <span className="max-w-[150px] truncate block">{row.latest_disposition || "-"}</span>
          ),
        },
        {
          header: "Last Call",
          accessorKey: "last_call_date",
          cell: (row: any) => row.last_call_date ? format(new Date(row.last_call_date), "MMM dd, yyyy") : "-",
        },
        {
          header: "Next Call",
          accessorKey: "next_call_date",
          cell: (row: any) => row.next_call_date ? format(new Date(row.next_call_date), "MMM dd, yyyy") : "-",
        },
      ] as DataTableColumn<T>[];

    case "mandates":
      return [
        {
          header: "Job Title",
          accessorKey: "job_title",
          cell: (row: any) => (
            <span className="max-w-[250px] truncate block font-medium">{row.job_title}</span>
          ),
        },
        {
          header: "Client",
          accessorKey: "clients",
          cell: (row: any) => (
            <span className="max-w-[200px] truncate block">
              {row.clients?.company_name || "-"}
            </span>
          ),
        },
        {
          header: "Status",
          accessorKey: "mandate_status",
          cell: (row: any) => {
            const statusVariant = 
              row.mandate_status === "open" ? "default" :
              row.mandate_status === "closed" ? "default" :
              row.mandate_status === "on-hold" ? "secondary" :
              "outline";
            
            return (
              <Badge variant={statusVariant}>
                {row.mandate_status}
              </Badge>
            );
          },
        },
        {
          header: "Created",
          accessorKey: "created_at",
          cell: (row: any) => format(new Date(row.created_at), "MMM dd, yyyy"),
        },
        {
          header: "Description",
          accessorKey: "job_description",
          cell: (row: any) => (
            <span className="max-w-[300px] truncate block text-muted-foreground">
              {row.job_description ? (row.job_description.length > 50 ? row.job_description.substring(0, 50) + "..." : row.job_description) : "-"}
            </span>
          ),
        },
      ] as DataTableColumn<T>[];

    default:
      return [];
  }
}

export function getRowKey(source: DataSource) {
  // All tables use 'id' as primary key
  return (row: any) => row.id;
}