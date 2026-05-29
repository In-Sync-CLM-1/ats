import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuthCheck } from "@/hooks/useAuthCheck";
import {
  WhatsAppHeaderSection,
  WhatsAppFooterSection,
  WhatsAppButtonsSection,
  WhatsAppVariableMapper,
  WhatsAppPreview,
  WhatsAppLanguageSelect,
  type HeaderType,
  type WhatsAppButton,
  type VariableMapping,
} from "@/components/whatsapp";

const CATEGORIES = [
  { value: "MARKETING", label: "Marketing" },
  { value: "UTILITY", label: "Utility" },
  { value: "AUTHENTICATION", label: "Authentication" },
];

export default function WhatsAppTemplateForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id && id !== "new");
  useAuthCheck();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Basic info
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [languageCode, setLanguageCode] = useState("en");
  
  // Content
  const [headerType, setHeaderType] = useState<HeaderType>("none");
  const [headerContent, setHeaderContent] = useState("");
  const [body, setBody] = useState("");
  const [footer, setFooter] = useState("");
  
  // Interactive elements
  const [buttons, setButtons] = useState<WhatsAppButton[]>([]);
  const [variableMapping, setVariableMapping] = useState<VariableMapping>({});

  useEffect(() => {
    if (isEditing && id) {
      fetchTemplate(id);
    }
  }, [id, isEditing]);

  const fetchTemplate = async (templateId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .eq("id", templateId)
        .single();

      if (error) throw error;

      if (data) {
        setName(data.name);
        setBody(data.body);
        setCategory(data.category || "");
        setIsActive(data.is_active ?? true);
        setHeaderType((data.header_type as HeaderType) || "none");
        setHeaderContent(data.header_content || "");
        setFooter(data.footer || "");
        setLanguageCode(data.language_code || "en");
        setButtons(Array.isArray(data.buttons) ? (data.buttons as unknown as WhatsAppButton[]) : []);
        setVariableMapping((data.variable_mapping as unknown as VariableMapping) || {});
      }
    } catch (error: any) {
      toast.error("Failed to load template");
      navigate("/templates");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }
    
    if (!body.trim()) {
      toast.error("Message body is required");
      return;
    }

    // Validate buttons
    const invalidButtons = buttons.filter(b => !b.text.trim());
    if (invalidButtons.length > 0) {
      toast.error("All buttons must have text");
      return;
    }

    setIsSaving(true);
    try {
      // Extract merge tags (numbered variables)
      const mergeTagsRegex = /\{\{(\d+)\}\}/g;
      const foundTags = [...body.matchAll(mergeTagsRegex)].map(m => `{{${m[1]}}}`);
      const uniqueTags = [...new Set(foundTags)];

      const templateData = {
        name,
        body,
        category: category || null,
        is_active: isActive,
        header_type: headerType,
        header_content: headerType !== 'none' ? headerContent : null,
        footer: footer || null,
        buttons: buttons.length > 0 ? JSON.parse(JSON.stringify(buttons)) : [],
        language_code: languageCode,
        variable_mapping: JSON.parse(JSON.stringify(variableMapping)),
        merge_tags: uniqueTags,
      };

      if (isEditing && id) {
        const { error } = await supabase
          .from("whatsapp_templates")
          .update(templateData)
          .eq("id", id);

        if (error) throw error;
        toast.success("Template updated successfully");
      } else {
        const { error } = await supabase
          .from("whatsapp_templates")
          .insert(templateData);

        if (error) throw error;
        toast.success("Template created successfully");
      }

      navigate("/templates");
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(isEditing ? "Failed to update template" : "Failed to create template");
    } finally {
      setIsSaving(false);
    }
  };

  const insertVariable = (varNum: number) => {
    setBody(prev => prev + `{{${varNum}}}`);
  };

  if (isLoading) {
    return (
      <div className="px-8 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/templates")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {isEditing ? "Edit WhatsApp Template" : "New WhatsApp Template"}
          </h1>
          <p className="text-muted-foreground">
            Create templates with headers, buttons, and dynamic variables
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form - Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>Template Details</CardTitle>
                <CardDescription>Basic information about your template</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Template Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., interview_reminder"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use lowercase with underscores (WhatsApp API requirement)
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <WhatsAppLanguageSelect
                    languageCode={languageCode}
                    onLanguageChange={setLanguageCode}
                  />

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <div className="flex items-center gap-2 pt-2">
                      <Switch
                        checked={isActive}
                        onCheckedChange={setIsActive}
                      />
                      <span className="text-sm">{isActive ? "Active" : "Inactive"}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Header Section */}
            <Card>
              <CardContent className="pt-6">
                <WhatsAppHeaderSection
                  headerType={headerType}
                  headerContent={headerContent}
                  onHeaderTypeChange={setHeaderType}
                  onHeaderContentChange={setHeaderContent}
                />
              </CardContent>
            </Card>

            {/* Message Body */}
            <Card>
              <CardHeader>
                <CardTitle>Message Body *</CardTitle>
                <CardDescription>
                  Use {"{{1}}"}, {"{{2}}"}, etc. for variables. Max 1024 characters.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 flex-wrap mb-2">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <Button
                      key={num}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => insertVariable(num)}
                    >
                      {`{{${num}}}`}
                    </Button>
                  ))}
                </div>
                <Textarea
                  placeholder="Hi {{1}}, this is a reminder about your interview at {{2}} scheduled for {{3}}..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="min-h-[150px] font-mono"
                  maxLength={1024}
                />
                <p className="text-sm text-muted-foreground">
                  {body.length}/1024 characters
                </p>
              </CardContent>
            </Card>

            {/* Footer Section */}
            <Card>
              <CardContent className="pt-6">
                <WhatsAppFooterSection
                  footer={footer}
                  onFooterChange={setFooter}
                />
              </CardContent>
            </Card>

            {/* Buttons Section */}
            <Card>
              <CardContent className="pt-6">
                <WhatsAppButtonsSection
                  buttons={buttons}
                  onButtonsChange={setButtons}
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Right Column */}
          <div className="space-y-6">
            {/* Variable Mapper */}
            <WhatsAppVariableMapper
              body={body}
              headerContent={headerContent}
              variableMapping={variableMapping}
              onVariableMappingChange={setVariableMapping}
            />

            <Separator />

            {/* Preview */}
            <WhatsAppPreview
              headerType={headerType}
              headerContent={headerContent}
              body={body}
              footer={footer}
              buttons={buttons}
              variableMapping={variableMapping}
            />
          </div>
        </div>

        <div className="flex gap-3 sticky bottom-4 bg-background/80 backdrop-blur-sm p-4 rounded-lg border">
          <Button type="submit" disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : isEditing ? "Update Template" : "Create Template"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/templates")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
