import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Loader2, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";

interface RecipientData {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  phone_secondary?: string;
  linkedin_url?: string;
  designation?: string;
  position_applied_for?: string;
  current_company?: string;
  current_status?: string;
  interview_stage?: string;
  address?: string;
  location?: string;
  city?: string;
  state?: string;
  pincode?: string;
  total_experience_years?: number;
  current_ctc_lakhs?: number;
  expected_ctc_lakhs?: number;
  latest_disposition?: string;
  latest_subdisposition?: string;
  last_call_date?: string;
}

interface EmailComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientData: RecipientData;
  onEmailSent?: () => void;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  category?: string;
}

export function EmailComposeDialog({ 
  open, 
  onOpenChange, 
  recipientData,
  onEmailSent 
}: EmailComposeDialogProps) {
  const [mode, setMode] = useState<'simple' | 'template'>('simple');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [fromName, setFromName] = useState("ATS");
  const [replyTo, setReplyTo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (open) {
      fetchTemplates();
      fetchUserEmail();
      resetForm();
    }
  }, [open]);

  useEffect(() => {
    if (selectedTemplateId) {
      const template = templates.find(t => t.id === selectedTemplateId);
      if (template) {
        setSubject(template.subject);
        setBody(template.body_html);
      }
    }
  }, [selectedTemplateId, templates]);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('id, name, subject, body_html, category')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to load email templates');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserEmail = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      setReplyTo(user.email);
    }
  };

  const resetForm = () => {
    setMode('simple');
    setSelectedTemplateId("");
    setSubject("");
    setBody("");
    setFromName("ATS");
  };

  const getMergeData = (): Record<string, any> => {
    const fullName = `${recipientData.first_name} ${recipientData.last_name}`.trim();

    return {
      name: fullName,
      first_name: recipientData.first_name || '',
      last_name: recipientData.last_name || '',
      email: recipientData.email || '',
      phone: recipientData.phone || '',
      phone_secondary: recipientData.phone_secondary || '',
      designation: recipientData.designation || '',
      position_applied_for: recipientData.position_applied_for || '',
      current_company: recipientData.current_company || '',
      current_status: recipientData.current_status || '',
      interview_stage: recipientData.interview_stage || '',
      location: recipientData.location || '',
      city: recipientData.city || '',
      state: recipientData.state || '',
      pincode: recipientData.pincode || '',
      address: recipientData.address || '',
      linkedin_url: recipientData.linkedin_url || '',
      total_experience_years: recipientData.total_experience_years || '',
      current_ctc_lakhs: recipientData.current_ctc_lakhs || '',
      expected_ctc_lakhs: recipientData.expected_ctc_lakhs || '',
      latest_disposition: recipientData.latest_disposition || '',
      latest_subdisposition: recipientData.latest_subdisposition || '',
      last_call_date: recipientData.last_call_date || '',
    };
  };

  const insertMergeTag = (tag: string) => {
    setBody(prev => prev + ` {{${tag}}}`);
  };

  const getPreviewBody = (): string => {
    let preview = body;
    const mergeData = getMergeData();
    
    Object.keys(mergeData).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      preview = preview.replace(regex, mergeData[key] || '');
    });
    
    return preview;
  };

  const validateForm = (): boolean => {
    if (!subject.trim()) {
      toast.error('Please enter an email subject');
      return false;
    }
    
    if (!body.trim()) {
      toast.error('Please enter email content');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientData.email)) {
      toast.error('Invalid recipient email address');
      return false;
    }

    if (replyTo && !emailRegex.test(replyTo)) {
      toast.error('Invalid reply-to email address');
      return false;
    }

    return true;
  };

  const handleSendEmail = async () => {
    if (!validateForm()) return;

    setIsSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in to send emails');
        return;
      }

      const mergeData = getMergeData();

      const fullName = `${recipientData.first_name} ${recipientData.last_name}`.trim();
      
      const { data, error } = await supabase.functions.invoke('send-simple-email', {
        body: {
          to_email: recipientData.email,
          to_name: fullName,
          from_name: fromName,
          reply_to: replyTo || undefined,
          subject: subject,
          html_body: body,
          demandcom_id: recipientData.id, // Keep DB column name for compatibility
          template_id: selectedTemplateId || undefined,
          merge_data: mergeData,
        },
      });

      if (error) throw error;

      toast.success(`Email sent successfully to ${fullName}`);
      onEmailSent?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast.error(error.message || 'Failed to send email. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const commonMergeTags = [
    { key: 'name', label: 'Full Name' },
    { key: 'first_name', label: 'First Name' },
    { key: 'position_applied_for', label: 'Position' },
    { key: 'current_company', label: 'Company' },
    { key: 'location', label: 'Location' },
  ];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isSending && onOpenChange(isOpen)}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Email to {recipientData.first_name} {recipientData.last_name}
          </DialogTitle>
          <DialogDescription>
            Compose and send an email directly to this candidate
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Mode Selection */}
          <div className="space-y-3">
            <Label>Email Mode</Label>
            <RadioGroup value={mode} onValueChange={(value) => setMode(value as 'simple' | 'template')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="simple" id="simple" />
                <Label htmlFor="simple" className="font-normal cursor-pointer">
                  Simple Compose (Quick message)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="template" id="template" />
                <Label htmlFor="template" className="font-normal cursor-pointer">
                  Use Template (Pre-designed email)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Template Selection */}
          {mode === 'template' && (
            <div className="space-y-2">
              <Label>Select Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an email template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                      {template.category && (
                        <Badge variant="outline" className="ml-2">
                          {template.category}
                        </Badge>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Recipient Info */}
          <Card className="p-4 bg-muted/50">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="font-medium">To:</span> {recipientData.email}
              </div>
              <div>
                <span className="font-medium">Name:</span> {recipientData.first_name} {recipientData.last_name}
              </div>
              {recipientData.position_applied_for && (
                <div>
                  <span className="font-medium">Position:</span> {recipientData.position_applied_for}
                </div>
              )}
              {recipientData.current_company && (
                <div>
                  <span className="font-medium">Company:</span> {recipientData.current_company}
                </div>
              )}
            </div>
          </Card>

          {/* Email Form Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fromName">From Name</Label>
              <Input
                id="fromName"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="ATS"
                disabled={isSending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="replyTo">Reply-To Email</Label>
              <Input
                id="replyTo"
                type="email"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                placeholder="your@email.com"
                disabled={isSending}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">
              Subject <span className="text-destructive">*</span>
            </Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Your email subject..."
              required
              disabled={isSending}
            />
          </div>

          {/* Merge Tags Helper */}
          <div className="space-y-2">
            <Label>Quick Personalization</Label>
            <div className="flex flex-wrap gap-2">
              {commonMergeTags.map((tag) => (
                <Button
                  key={tag.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertMergeTag(tag.key)}
                  disabled={isSending}
                  className="text-xs"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  {tag.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Click to insert personalization tags into your message
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">
              Message <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              placeholder={`Hi {{name}},

I hope this message finds you well.

[Your message here]

Best regards,
ATS Team`}
              required
              disabled={isSending}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Use {"{{merge_tag}}"} syntax for personalization. HTML is supported.
            </p>
          </div>

          {/* Preview */}
          {body && (
            <div className="space-y-2">
              <Label>Preview (with merge tags replaced)</Label>
              <Card className="p-4 bg-muted/30">
                <div className="text-sm whitespace-pre-wrap">{getPreviewBody()}</div>
              </Card>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSendEmail}
            disabled={isSending || !subject.trim() || !body.trim()}
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
