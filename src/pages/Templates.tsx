import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Mail, MessageCircle, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthCheck } from "@/hooks/useAuthCheck";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { DataTable, DataTableColumn } from "@/components/data-table/DataTable";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  category: string | null;
  is_active: boolean;
  version: number;
  created_at: string;
}

interface WhatsAppTemplate {
  id: string;
  name: string;
  body: string;
  category: string | null;
  is_active: boolean;
  created_at: string;
}

export default function Templates() {
  const navigate = useNavigate();
  useAuthCheck();

  const {
    data: emailTemplates,
    totalCount: emailCount,
    totalPages: emailTotalPages,
    currentPage: emailPage,
    itemsPerPage: emailPerPage,
    isLoading: emailLoading,
    handlePageChange: handleEmailPageChange,
    handleItemsPerPageChange: handleEmailPerPageChange,
    refetch: refetchEmail,
  } = usePaginatedQuery<EmailTemplate>({
    queryKey: ["email_templates"],
    queryFn: async (from, to) => {
      const { data, error, count } = await supabase
        .from("email_templates")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      return { data, count, error };
    },
  });

  const {
    data: whatsappTemplates,
    totalCount: whatsappCount,
    totalPages: whatsappTotalPages,
    currentPage: whatsappPage,
    itemsPerPage: whatsappPerPage,
    isLoading: whatsappLoading,
    handlePageChange: handleWhatsappPageChange,
    handleItemsPerPageChange: handleWhatsappPerPageChange,
    refetch: refetchWhatsapp,
  } = usePaginatedQuery<WhatsAppTemplate>({
    queryKey: ["whatsapp_templates"],
    queryFn: async (from, to) => {
      const { data, error, count } = await supabase
        .from("whatsapp_templates")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      return { data, count, error };
    },
  });

  const handleDeleteEmailTemplate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      const { error } = await supabase.from("email_templates").delete().eq("id", id);
      if (error) throw error;

      toast.success("Email template deleted");
      refetchEmail();
    } catch (error: any) {
      toast.error("Failed to delete email template");
    }
  };

  const handleDeleteWhatsAppTemplate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      const { error } = await supabase.from("whatsapp_templates").delete().eq("id", id);
      if (error) throw error;

      toast.success("WhatsApp template deleted");
      refetchWhatsapp();
    } catch (error: any) {
      toast.error("Failed to delete WhatsApp template");
    }
  };

  const emailColumns: DataTableColumn<EmailTemplate>[] = [
    {
      header: "Name",
      cell: (template) => <span className="font-medium">{template.name}</span>,
    },
    {
      header: "Subject",
      accessorKey: "subject",
    },
    {
      header: "Category",
      cell: (template) => template.category || "—",
    },
    {
      header: "Version",
      cell: (template) => `v${template.version}`,
    },
    {
      header: "Status",
      cell: (template) => (
        <Badge variant={template.is_active ? "default" : "outline"}>
          {template.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  const whatsappColumns: DataTableColumn<WhatsAppTemplate>[] = [
    {
      header: "Name",
      cell: (template) => <span className="font-medium">{template.name}</span>,
    },
    {
      header: "Message Preview",
      cell: (template) => <span className="max-w-xs truncate block">{template.body}</span>,
    },
    {
      header: "Category",
      cell: (template) => template.category || "—",
    },
    {
      header: "Status",
      cell: (template) => (
        <Badge variant={template.is_active ? "default" : "outline"}>
          {template.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="px-8 py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Templates</h1>
        <p className="text-muted-foreground">
          Create and manage email and WhatsApp templates for your campaigns
        </p>
      </div>

        <Tabs defaultValue="email" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Templates
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              WhatsApp Templates
            </TabsTrigger>
          </TabsList>

          {/* Email Templates Tab */}
          <TabsContent value="email">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Email Templates ({emailTemplates.length})</CardTitle>
                  <CardDescription>
                    Design beautiful email templates with merge tags
                  </CardDescription>
                </div>
                <Button onClick={() => navigate("/templates/email/new")}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Email Template
                </Button>
              </CardHeader>
              <CardContent>
                <DataTable
                  data={emailTemplates}
                  columns={emailColumns}
                  isLoading={emailLoading}
                  getRowKey={(template) => template.id}
                  emptyState={{
                    icon: Mail,
                    title: "No email templates found",
                    description: "Get started by creating your first email template",
                    actionLabel: "New Email Template",
                    onAction: () => navigate("/templates/email/new"),
                  }}
                  pagination={{
                    currentPage: emailPage,
                    totalPages: emailTotalPages,
                    totalItems: emailCount,
                    itemsPerPage: emailPerPage,
                    onPageChange: handleEmailPageChange,
                    onItemsPerPageChange: handleEmailPerPageChange,
                  }}
                  actions={(template) => (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/templates/email/${template.id}`)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteEmailTemplate(template.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* WhatsApp Templates Tab */}
          <TabsContent value="whatsapp">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>WhatsApp Templates ({whatsappTemplates.length})</CardTitle>
                  <CardDescription>
                    Create WhatsApp message templates with merge tags
                  </CardDescription>
                </div>
                <Button onClick={() => navigate("/templates/whatsapp/new")}>
                  <Plus className="h-4 w-4 mr-2" />
                  New WhatsApp Template
                </Button>
              </CardHeader>
              <CardContent>
                <DataTable
                  data={whatsappTemplates}
                  columns={whatsappColumns}
                  isLoading={whatsappLoading}
                  getRowKey={(template) => template.id}
                  emptyState={{
                    icon: MessageCircle,
                    title: "No WhatsApp templates found",
                    description: "Get started by creating your first WhatsApp template",
                    actionLabel: "New WhatsApp Template",
                    onAction: () => navigate("/templates/whatsapp/new"),
                  }}
                  pagination={{
                    currentPage: whatsappPage,
                    totalPages: whatsappTotalPages,
                    totalItems: whatsappCount,
                    itemsPerPage: whatsappPerPage,
                    onPageChange: handleWhatsappPageChange,
                    onItemsPerPageChange: handleWhatsappPerPageChange,
                  }}
                  actions={(template) => (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/templates/whatsapp/${template.id}`)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteWhatsAppTemplate(template.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
    </div>
  );
}