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
import { MessageCircle, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

interface WhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateData: CandidateData;
  onMessageSent?: () => void;
}

export function WhatsAppDialog({ open, onOpenChange, candidateData, onMessageSent }: WhatsAppDialogProps) {
  const [phoneNumber, setPhoneNumber] = useState(candidateData.phone);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (open) {
      setPhoneNumber(candidateData.phone);
      setMessage("");
    }
  }, [open, candidateData]);

  const handleSendMessage = async () => {
    if (!phoneNumber.trim()) {
      toast.error("Phone number is required");
      return;
    }

    if (!message.trim()) {
      toast.error("Message is required");
      return;
    }

    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('exotel-send-whatsapp', {
        body: {
          to_number: phoneNumber,
          message: message,
          candidate_id: candidateData.id,
        },
      });

      if (error) {
        console.error('WhatsApp error:', error);
        toast.error(error.message || 'Failed to send WhatsApp message');
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success('WhatsApp message sent successfully');
      onMessageSent?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
      toast.error('Failed to send WhatsApp message');
    } finally {
      setIsSending(false);
    }
  };

  const fullName = `${candidateData.first_name} ${candidateData.last_name}`;

  const quickMessages = [
    "Hi {name}, this is regarding your job application. Are you available for a quick call?",
    "Hi {name}, we have reviewed your profile. Please share your updated resume.",
    "Hi {name}, your interview has been scheduled. Please confirm your availability.",
  ];

  const insertQuickMessage = (template: string) => {
    const personalizedMessage = template.replace('{name}', candidateData.first_name);
    setMessage(personalizedMessage);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            WhatsApp {fullName}
          </DialogTitle>
          <DialogDescription>
            Send a WhatsApp message to the candidate
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Enter phone number with country code"
            />
            <p className="text-xs text-muted-foreground">
              Include country code (e.g., +91 for India)
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Email:</span>
              <p>{candidateData.email || "N/A"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Position:</span>
              <p>{candidateData.position_applied_for || "N/A"}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Quick Messages</Label>
            <div className="flex flex-wrap gap-2">
              {quickMessages.map((template, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="text-xs h-auto py-1 px-2"
                  onClick={() => insertQuickMessage(template)}
                >
                  Template {index + 1}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {message.length} characters
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button 
            onClick={handleSendMessage} 
            disabled={isSending || !message.trim()}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Message
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
