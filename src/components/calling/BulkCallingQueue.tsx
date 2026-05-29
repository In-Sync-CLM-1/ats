import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, CheckCircle2, XCircle, Clock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EnhancedCallDialog } from "../EnhancedCallDialog";
import { EmptyState } from "../ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { BulkCallCandidate } from "@/pages/CallingDashboard";

interface CallStatus {
  candidateIndex: number;
  status: "pending" | "calling" | "completed" | "skipped";
  disposition?: string;
}

interface BulkCallingQueueProps {
  candidates: BulkCallCandidate[];
  onComplete: () => void;
}

export function BulkCallingQueue({ candidates, onComplete }: BulkCallingQueueProps) {
  const [callStatuses, setCallStatuses] = useState<CallStatus[]>(
    candidates.map((_, index) => ({ candidateIndex: index, status: "pending" }))
  );
  const [currentCandidateIndex, setCurrentCandidateIndex] = useState<number | null>(null);
  const [showCallDialog, setShowCallDialog] = useState(false);

  const currentCandidate = currentCandidateIndex !== null ? candidates[currentCandidateIndex] : null;

  const stats = {
    total: candidates.length,
    completed: callStatuses.filter(s => s.status === "completed").length,
    pending: callStatuses.filter(s => s.status === "pending").length,
    skipped: callStatuses.filter(s => s.status === "skipped").length,
  };

  const progress = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

  const handleStartCall = (index: number) => {
    setCurrentCandidateIndex(index);
    setCallStatuses(prev => 
      prev.map(s => 
        s.candidateIndex === index ? { ...s, status: "calling" } : s
      )
    );
    setShowCallDialog(true);
  };

  const handleCallComplete = (disposition?: string) => {
    if (currentCandidateIndex !== null) {
      setCallStatuses(prev =>
        prev.map(s =>
          s.candidateIndex === currentCandidateIndex
            ? { ...s, status: "completed", disposition }
            : s
        )
      );
      
      // Auto-advance to next pending candidate
      const nextPending = callStatuses.findIndex(
        (s, idx) => idx > currentCandidateIndex && s.status === "pending"
      );
      
      if (nextPending !== -1) {
        setTimeout(() => {
          setCurrentCandidateIndex(nextPending);
          setShowCallDialog(true);
        }, 500);
      } else {
        setCurrentCandidateIndex(null);
      }
    }
    setShowCallDialog(false);
  };

  const handleSkipCandidate = (index: number) => {
    setCallStatuses(prev =>
      prev.map(s =>
        s.candidateIndex === index ? { ...s, status: "skipped" } : s
      )
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "text-green-600 bg-green-50";
      case "calling": return "text-blue-600 bg-blue-50";
      case "skipped": return "text-gray-600 bg-gray-50";
      default: return "text-yellow-600 bg-yellow-50";
    }
  };

  if (candidates.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No candidates selected"
        description="Select candidates from the Candidates page to start bulk calling"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Bulk Calling Progress</span>
            <Button variant="outline" size="sm" onClick={onComplete}>
              End Session
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress: {stats.completed} / {stats.total}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </div>
          
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{stats.skipped}</div>
              <div className="text-xs text-muted-foreground">Skipped</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Candidate List */}
      <Card>
        <CardHeader>
          <CardTitle>Candidates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {candidates.map((candidate, index) => {
              const status = callStatuses[index];
              const isCurrent = currentCandidateIndex === index;

              return (
                <div
                  key={candidate.id || index}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    isCurrent ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {status.status === "completed" && (
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    )}
                    {status.status === "skipped" && (
                      <XCircle className="h-5 w-5 text-gray-600 flex-shrink-0" />
                    )}
                    {status.status === "calling" && (
                      <Phone className="h-5 w-5 text-blue-600 flex-shrink-0 animate-pulse" />
                    )}
                    {status.status === "pending" && (
                      <Clock className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{candidate.name}</p>
                      <p className="text-sm text-muted-foreground">{candidate.phone}</p>
                      {candidate.current_company && (
                        <p className="text-xs text-muted-foreground truncate">
                          {candidate.current_company}
                          {candidate.designation && ` • ${candidate.designation}`}
                        </p>
                      )}
                      {candidate.position_applied_for && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          {candidate.position_applied_for}
                        </Badge>
                      )}
                      {status.disposition && (
                        <Badge variant="secondary" className="mt-1 ml-1 text-xs">
                          {status.disposition}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    {status.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleStartCall(index)}
                        >
                          <Phone className="h-4 w-4 mr-2" />
                          Call
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSkipCandidate(index)}
                        >
                          Skip
                        </Button>
                      </>
                    )}
                    {status.status === "completed" && (
                      <Badge className={getStatusColor(status.status)}>
                        Completed
                      </Badge>
                    )}
                    {status.status === "skipped" && (
                      <Badge className={getStatusColor(status.status)}>
                        Skipped
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Call Dialog */}
      {currentCandidate && (
        <EnhancedCallDialog
          open={showCallDialog}
          onOpenChange={(open) => {
            setShowCallDialog(open);
            if (!open) {
              handleCallComplete();
            }
          }}
          candidateData={{
            id: currentCandidate.id,
            first_name: currentCandidate.name.split(" ")[0] || currentCandidate.name,
            last_name: currentCandidate.name.split(" ").slice(1).join(" ") || "",
            phone: currentCandidate.phone,
            email: currentCandidate.email || null,
            designation: currentCandidate.designation || null,
            current_company: currentCandidate.current_company || null,
            position_applied_for: currentCandidate.position_applied_for || "",
          }}
        />
      )}
    </div>
  );
}
