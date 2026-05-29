import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CallHistory } from "./CallHistory";

interface CandidateCallHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  candidateName: string;
}

export function CandidateCallHistorySheet({
  open,
  onOpenChange,
  candidateId,
  candidateName,
}: CandidateCallHistorySheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Call History - {candidateName}</SheetTitle>
          <SheetDescription>
            View all calls, recordings, and dispositions for this candidate
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <CallHistory candidateId={candidateId} showFilters={false} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
