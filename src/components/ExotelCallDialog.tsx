import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, PhoneOff, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useExotelCall } from "@/hooks/useExotelCall";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";

interface CandidateData {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string | null;
  designation?: string | null;
  current_company?: string | null;
  position_applied_for?: string;
}

interface ExotelCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateData: CandidateData;
  onCallComplete?: () => void;
}

interface CallDisposition {
  disposition: string;
  subdispositions: string[];
}

export function ExotelCallDialog({ open, onOpenChange, candidateData, onCallComplete }: ExotelCallDialogProps) {
  const [phoneNumber, setPhoneNumber] = useState(candidateData.phone);
  const [dispositions, setDispositions] = useState<CallDisposition[]>([]);
  const [selectedDisposition, setSelectedDisposition] = useState("");
  const [selectedSubdisposition, setSelectedSubdisposition] = useState("");
  const [notes, setNotes] = useState("");
  const [nextCallDate, setNextCallDate] = useState<Date | undefined>();
  const [userPhone, setUserPhone] = useState<string | null>(null);

  const {
    callStatus,
    callDuration,
    isLoading,
    initiateCall,
    endCall,
    resetCall,
    formatDuration,
  } = useExotelCall();

  useEffect(() => {
    if (open) {
      setPhoneNumber(candidateData.phone);
      fetchDispositions();
      fetchUserPhone();
      resetCall();
      setSelectedDisposition("");
      setSelectedSubdisposition("");
      setNotes("");
      setNextCallDate(undefined);
    }
  }, [open, candidateData]);

  const fetchUserPhone = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone")
        .eq("id", user.id)
        .single();
      
      if (profile?.phone) {
        setUserPhone(profile.phone);
      }
    }
  };

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

  const handleStartCall = async () => {
    if (!phoneNumber.trim()) {
      toast.error("Phone number is required");
      return;
    }

    await initiateCall(phoneNumber, candidateData.id, userPhone || undefined);
  };

  const handleEndCall = async () => {
    await endCall(selectedDisposition, selectedSubdisposition, notes, nextCallDate?.toISOString());
    
    // Update candidate with disposition and next call date
    if (selectedDisposition) {
      const { error } = await supabase
        .from("candidates")
        .update({
          latest_disposition: selectedDisposition,
          latest_subdisposition: selectedSubdisposition || null,
          next_call_date: nextCallDate?.toISOString() || null,
        })
        .eq("id", candidateData.id);

      if (error) {
        console.error("Error updating candidate:", error);
      }
    }
  };

  const handleClose = () => {
    if (callStatus !== "idle" && callStatus !== "completed" && callStatus !== "failed") {
      toast.error("Please end the call before closing");
      return;
    }
    
    resetCall();
    onCallComplete?.();
    onOpenChange(false);
  };

  const availableSubdispositions = dispositions.find(d => d.disposition === selectedDisposition)?.subdispositions || [];
  const fullName = `${candidateData.first_name} ${candidateData.last_name}`;

  const renderPreCallState = () => (
    <>
      <DialogHeader>
        <DialogTitle>Call {fullName}</DialogTitle>
        <DialogDescription>
          Verify phone number before initiating call
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="Enter phone number"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Email:</span>
            <p>{candidateData.email || "N/A"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Designation:</span>
            <p>{candidateData.designation || "N/A"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Company:</span>
            <p>{candidateData.current_company || "N/A"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Position:</span>
            <p>{candidateData.position_applied_for || "N/A"}</p>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={handleClose}>
          Cancel
        </Button>
        <Button onClick={handleStartCall} disabled={isLoading}>
          <Phone className="mr-2 h-4 w-4" />
          {isLoading ? "Initiating..." : "Start Call"}
        </Button>
      </DialogFooter>
    </>
  );

  const renderCallingState = () => (
    <>
      <DialogHeader>
        <DialogTitle>Calling {fullName}</DialogTitle>
        <DialogDescription>
          {callStatus === "ringing" && "Phone is ringing..."}
          {callStatus === "in-progress" && "Call in progress"}
          {callStatus === "initiating" && "Initiating call..."}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
          <div className="relative bg-primary text-primary-foreground p-8 rounded-full">
            <Phone className="h-12 w-12" />
          </div>
        </div>

        <div className="flex items-center space-x-2 text-2xl font-mono">
          <Clock className="h-6 w-6 text-muted-foreground" />
          <span>{formatDuration(callDuration)}</span>
        </div>

        <p className="text-sm text-muted-foreground">
          Calling {phoneNumber}
        </p>
      </div>

      <DialogFooter>
        <Button variant="destructive" onClick={() => endCall()}>
          <PhoneOff className="mr-2 h-4 w-4" />
          End Call
        </Button>
      </DialogFooter>
    </>
  );

  const renderPostCallState = () => (
    <>
      <DialogHeader>
        <DialogTitle>Call Completed</DialogTitle>
        <DialogDescription>
          Add call disposition and notes
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <span className="text-sm text-muted-foreground">Call Duration</span>
          <span className="font-mono font-semibold">{formatDuration(callDuration)}</span>
        </div>

        <div className="space-y-2">
          <Label htmlFor="disposition">Disposition *</Label>
          <Select value={selectedDisposition} onValueChange={(value) => {
            setSelectedDisposition(value);
            setSelectedSubdisposition("");
          }}>
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

        {availableSubdispositions.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="subdisposition">Sub-disposition</Label>
            <Select value={selectedSubdisposition} onValueChange={setSelectedSubdisposition}>
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
        )}

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add call notes..."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label>Next Call Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !nextCallDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {nextCallDate ? format(nextCallDate, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={nextCallDate}
                onSelect={setNextCallDate}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={handleClose}>
          Skip & Close
        </Button>
        <Button onClick={async () => {
          if (!selectedDisposition) {
            toast.error("Please select a disposition");
            return;
          }
          await handleEndCall();
          handleClose();
        }}>
          Save & Close
        </Button>
      </DialogFooter>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        {(callStatus === "idle" || callStatus === "failed") && renderPreCallState()}
        {(callStatus === "initiating" || callStatus === "ringing" || callStatus === "in-progress") && renderCallingState()}
        {callStatus === "completed" && renderPostCallState()}
      </DialogContent>
    </Dialog>
  );
}
