import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";
import { EnhancedCallDialog } from "./EnhancedCallDialog";

interface CallButtonProps {
  phoneNumber: string;
  candidateId?: string;
  candidateFirstName?: string;
  candidateLastName?: string;
  candidateData?: any;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  showLabel?: boolean;
}

export function CallButton({
  phoneNumber,
  candidateId,
  candidateFirstName,
  candidateLastName,
  candidateData,
  variant = "outline",
  size = "sm",
  showLabel = true,
}: CallButtonProps) {
  const [showEnhancedDialog, setShowEnhancedDialog] = useState(false);

  // Don't render if no phone number
  if (!phoneNumber) {
    return null;
  }

  // Prepare candidate data with required ATS fields
  const callData = candidateData || {
    id: candidateId || "",
    first_name: candidateFirstName || "",
    last_name: candidateLastName || "",
    phone: phoneNumber,
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setShowEnhancedDialog(true)}
      >
        <Phone className="h-4 w-4" />
        {showLabel && <span className="ml-2">Call</span>}
      </Button>

      <EnhancedCallDialog
        open={showEnhancedDialog}
        onOpenChange={setShowEnhancedDialog}
        candidateData={callData}
      />
    </>
  );
}
