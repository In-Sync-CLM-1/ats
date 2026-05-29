import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

interface FreshApplicationBadgeProps {
  applicationSubmittedAt?: string | null;
  className?: string;
}

export function FreshApplicationBadge({ 
  applicationSubmittedAt, 
  className = "" 
}: FreshApplicationBadgeProps) {
  if (!applicationSubmittedAt) return null;

  const submittedDate = new Date(applicationSubmittedAt);
  const now = new Date();
  const daysSinceSubmission = Math.floor(
    (now.getTime() - submittedDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Only show badge for applications within 7 days
  if (daysSinceSubmission > 7) return null;

  return (
    <Badge 
      variant="default" 
      className={`bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 animate-pulse ${className}`}
    >
      <Sparkles className="h-3 w-3 mr-1" />
      Fresh Application
    </Badge>
  );
}