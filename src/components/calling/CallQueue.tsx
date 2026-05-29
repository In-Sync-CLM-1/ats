import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Phone, Clock, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EnhancedCallDialog } from "@/components/EnhancedCallDialog";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";

interface QueueCandidate {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  latest_disposition: string | null;
  next_call_date: string | null;
  current_company: string | null;
  position_applied_for: string;
  isOverdue: boolean;
}

interface CallQueueProps {
  onCallComplete?: () => void;
}

export function CallQueue({ onCallComplete }: CallQueueProps) {
  const [selectedCandidate, setSelectedCandidate] = useState<QueueCandidate | null>(null);
  const [showCallDialog, setShowCallDialog] = useState(false);

  const { data: queueCandidates, isLoading } = useQuery({
    queryKey: ["call-queue"],
    queryFn: async (): Promise<QueueCandidate[]> => {
      const now = new Date();

      // Get candidates with scheduled callbacks or no call history
      const { data, error } = await supabase
        .from("candidates")
        .select("id, first_name, last_name, phone, latest_disposition, next_call_date, current_company, position_applied_for")
        .not("phone", "is", null)
        .or(`next_call_date.lte.${now.toISOString()},next_call_date.is.null`)
        .limit(50);

      if (error) throw error;

      // Mark overdue candidates
      const candidates = (data || []).map(candidate => ({
        ...candidate,
        isOverdue: candidate.next_call_date && new Date(candidate.next_call_date) < now,
      }));

      // Sort: overdue first, then by next_call_date
      candidates.sort((a, b) => {
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        if (a.next_call_date && b.next_call_date) {
          return new Date(a.next_call_date).getTime() - new Date(b.next_call_date).getTime();
        }
        return 0;
      });

      return candidates;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const handleCallClick = (candidate: QueueCandidate) => {
    setSelectedCandidate(candidate);
    setShowCallDialog(true);
  };

  const handleCallDialogClose = (open: boolean) => {
    setShowCallDialog(open);
    if (!open) {
      setSelectedCandidate(null);
      if (onCallComplete) {
        onCallComplete();
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (!queueCandidates || queueCandidates.length === 0) {
    return (
      <EmptyState
        icon={Phone}
        title="No calls in queue"
        description="All callbacks are up to date! Great job!"
      />
    );
  }

  return (
    <>
      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {queueCandidates.map((candidate) => (
          <div
            key={candidate.id}
            className={`flex items-center justify-between p-4 rounded-lg border ${
              candidate.isOverdue
                ? "border-red-200 bg-red-50"
                : "border-border bg-card"
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium truncate">
                  {candidate.first_name} {candidate.last_name}
                </p>
                {candidate.isOverdue && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Overdue
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{candidate.phone}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                {candidate.position_applied_for && (
                  <span className="truncate">{candidate.position_applied_for}</span>
                )}
                {candidate.current_company && (
                  <span className="truncate">• {candidate.current_company}</span>
                )}
              </div>
              {candidate.next_call_date && (
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>
                    Scheduled {formatDistanceToNow(new Date(candidate.next_call_date), { addSuffix: true })}
                  </span>
                </div>
              )}
              {candidate.latest_disposition && (
                <Badge variant="outline" className="mt-2 text-xs">
                  Last: {candidate.latest_disposition}
                </Badge>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => handleCallClick(candidate)}
              className="ml-4 flex-shrink-0"
            >
              <Phone className="h-4 w-4 mr-2" />
              Call Now
            </Button>
          </div>
        ))}
      </div>

      {selectedCandidate && (
        <EnhancedCallDialog
          open={showCallDialog}
          onOpenChange={handleCallDialogClose}
          candidateData={{
            id: selectedCandidate.id,
            first_name: selectedCandidate.first_name,
            last_name: selectedCandidate.last_name,
            phone: selectedCandidate.phone,
          }}
        />
      )}
    </>
  );
}
