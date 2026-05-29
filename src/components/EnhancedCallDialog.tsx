import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, CalendarIcon, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface DemandComData {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  phone_secondary?: string | null;
  email?: string | null;
  linkedin_url?: string | null;
  designation?: string | null;
  position_applied_for?: string | null;
  current_company?: string | null;
  current_status?: string | null;
  interview_stage?: string | null;
  recruitment_status?: string | null;
  address?: string | null;
  location?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
  source?: string | null;
  total_experience_years?: number | null;
  current_ctc_lakhs?: number | null;
  expected_ctc_lakhs?: number | null;
  notice_period_days?: number | null;
  highest_qualification?: string | null;
  key_skills?: string | null;
  preferred_location?: string | null;
  current_location?: string | null;
  latest_disposition?: string | null;
  latest_subdisposition?: string | null;
  next_call_date?: string | null;
}

interface EnhancedCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateData: DemandComData;
  onCallInitiated?: () => void;
}

interface CallDisposition {
  disposition: string;
  subdispositions: string[];
}

export function EnhancedCallDialog({ open, onOpenChange, candidateData, onCallInitiated }: EnhancedCallDialogProps) {
  const [formData, setFormData] = useState<DemandComData>(candidateData);
  const [dispositions, setDispositions] = useState<CallDisposition[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setFormData(candidateData);
      fetchDispositions();
    }
  }, [open, candidateData]);

  const fetchDispositions = async () => {
    const { data, error } = await supabase
      .from("call_dispositions")
      .select("*")
      .eq("is_active", true)
      .order("disposition");

    if (!error && data) {
      setDispositions(data);
    }
  };

  const handleFieldChange = (field: keyof DemandComData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validatePhoneNumber = (phone: string) => {
    return /^[\d\s\+\-\(\)]+$/.test(phone);
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const isFormValid = () => {
    if (!formData.first_name?.trim() || !formData.last_name?.trim() || !formData.phone?.trim()) return false;
    if (!validatePhoneNumber(formData.phone)) return false;
    if (formData.email && !validateEmail(formData.email)) return false;
    return true;
  };

  const getEditedFields = () => {
    const edited: Record<string, any> = {};
    Object.keys(formData).forEach(key => {
      const fieldKey = key as keyof DemandComData;
      if (formData[fieldKey] !== candidateData[fieldKey]) {
        edited[key] = formData[fieldKey];
      }
    });
    return edited;
  };

  const handleSave = async () => {
    if (!isFormValid()) {
      toast.error("Please fill in all required fields correctly");
      return;
    }

    try {
      setIsLoading(true);

      const editedFields = getEditedFields();
      
      if (Object.keys(editedFields).length === 0) {
        toast.error("No changes to save");
        return;
      }

      const { error: updateError } = await supabase
        .from("candidates")
        .update(editedFields)
        .eq("id", candidateData.id);

      if (updateError) throw updateError;

      const fieldCount = Object.keys(editedFields).length;
      toast.success(`Successfully updated ${fieldCount} field${fieldCount > 1 ? 's' : ''}`);
      
      onCallInitiated?.();
      onOpenChange(false);
      
    } catch (error) {
      console.error("Error saving changes:", error);
      toast.error("Failed to save changes");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCallNow = () => {
    window.location.href = `tel:${formData.phone}`;
    toast.success("Opening dialer...");
  };

  const fullName = `${candidateData.first_name} ${candidateData.last_name}`.trim();
  const availableSubdispositions = dispositions.find(d => d.disposition === formData.latest_disposition)?.subdispositions || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Candidate - {fullName}</DialogTitle>
          <DialogDescription>
            Update candidate information and save changes
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="contact" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="professional">Professional</TabsTrigger>
            <TabsTrigger value="application">Application</TabsTrigger>
            <TabsTrigger value="location">Location</TabsTrigger>
          </TabsList>

          <TabsContent value="contact" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => handleFieldChange("first_name", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => handleFieldChange("last_name", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleFieldChange("phone", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone_secondary">Secondary Phone</Label>
                <Input
                  id="phone_secondary"
                  value={formData.phone_secondary || ""}
                  onChange={(e) => handleFieldChange("phone_secondary", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => handleFieldChange("email", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                <Input
                  id="linkedin_url"
                  value={formData.linkedin_url || ""}
                  onChange={(e) => handleFieldChange("linkedin_url", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="latest_disposition">Disposition</Label>
                <Select
                  value={formData.latest_disposition || ""}
                  onValueChange={(value) => {
                    handleFieldChange("latest_disposition", value);
                    handleFieldChange("latest_subdisposition", "");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select disposition" />
                  </SelectTrigger>
                  <SelectContent>
                    {dispositions.map((disp) => (
                      <SelectItem key={disp.disposition} value={disp.disposition}>
                        {disp.disposition}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="latest_subdisposition">Sub-disposition</Label>
                <Select
                  value={formData.latest_subdisposition || ""}
                  onValueChange={(value) => handleFieldChange("latest_subdisposition", value)}
                  disabled={!formData.latest_disposition || availableSubdispositions.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sub-disposition" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubdispositions.map((subdisp) => (
                      <SelectItem key={subdisp} value={subdisp}>
                        {subdisp}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="next_call_date">Next Call Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.next_call_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.next_call_date ? format(new Date(formData.next_call_date), "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.next_call_date ? new Date(formData.next_call_date) : undefined}
                      onSelect={(date) => handleFieldChange("next_call_date", date?.toISOString() || "")}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="professional" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="designation">Designation</Label>
                <Input
                  id="designation"
                  value={formData.designation || ""}
                  onChange={(e) => handleFieldChange("designation", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="current_company">Current Company</Label>
                <Input
                  id="current_company"
                  value={formData.current_company || ""}
                  onChange={(e) => handleFieldChange("current_company", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="total_experience_years">Total Experience (Years)</Label>
                <Input
                  id="total_experience_years"
                  type="number"
                  value={formData.total_experience_years || ""}
                  onChange={(e) => handleFieldChange("total_experience_years", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="current_ctc_lakhs">Current CTC (Lakhs)</Label>
                <Input
                  id="current_ctc_lakhs"
                  type="number"
                  step="0.01"
                  value={formData.current_ctc_lakhs || ""}
                  onChange={(e) => handleFieldChange("current_ctc_lakhs", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expected_ctc_lakhs">Expected CTC (Lakhs)</Label>
                <Input
                  id="expected_ctc_lakhs"
                  type="number"
                  step="0.01"
                  value={formData.expected_ctc_lakhs || ""}
                  onChange={(e) => handleFieldChange("expected_ctc_lakhs", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notice_period_days">Notice Period (Days)</Label>
                <Input
                  id="notice_period_days"
                  type="number"
                  value={formData.notice_period_days || ""}
                  onChange={(e) => handleFieldChange("notice_period_days", parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="highest_qualification">Highest Qualification</Label>
                <Input
                  id="highest_qualification"
                  value={formData.highest_qualification || ""}
                  onChange={(e) => handleFieldChange("highest_qualification", e.target.value)}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="key_skills">Key Skills</Label>
                <Textarea
                  id="key_skills"
                  value={formData.key_skills || ""}
                  onChange={(e) => handleFieldChange("key_skills", e.target.value)}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="application" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="position_applied_for">Position Applied For</Label>
                <Input
                  id="position_applied_for"
                  value={formData.position_applied_for || ""}
                  onChange={(e) => handleFieldChange("position_applied_for", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="current_status">Current Status</Label>
                <Input
                  id="current_status"
                  value={formData.current_status || ""}
                  onChange={(e) => handleFieldChange("current_status", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="interview_stage">Interview Stage</Label>
                <Input
                  id="interview_stage"
                  value={formData.interview_stage || ""}
                  onChange={(e) => handleFieldChange("interview_stage", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recruitment_status">Recruitment Status</Label>
                <Input
                  id="recruitment_status"
                  value={formData.recruitment_status || ""}
                  onChange={(e) => handleFieldChange("recruitment_status", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                <Input
                  id="source"
                  value={formData.source || ""}
                  onChange={(e) => handleFieldChange("source", e.target.value)}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="location" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={formData.address || ""}
                  onChange={(e) => handleFieldChange("address", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location || ""}
                  onChange={(e) => handleFieldChange("location", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city || ""}
                  onChange={(e) => handleFieldChange("city", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={formData.state || ""}
                  onChange={(e) => handleFieldChange("state", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.country || ""}
                  onChange={(e) => handleFieldChange("country", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pincode">Pincode</Label>
                <Input
                  id="pincode"
                  value={formData.pincode || ""}
                  onChange={(e) => handleFieldChange("pincode", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="current_location">Current Location</Label>
                <Input
                  id="current_location"
                  value={formData.current_location || ""}
                  onChange={(e) => handleFieldChange("current_location", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferred_location">Preferred Location</Label>
                <Input
                  id="preferred_location"
                  value={formData.preferred_location || ""}
                  onChange={(e) => handleFieldChange("preferred_location", e.target.value)}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleCallNow}>
            <Phone className="mr-2 h-4 w-4" />
            Call Now
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !isFormValid()}>
            <Save className="mr-2 h-4 w-4" />
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
