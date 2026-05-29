import { Button } from "@/components/ui/button";
import { Phone, X, Trash2, UserPlus } from "lucide-react";

interface CandidateSelectionBarProps {
  selectedCount: number;
  onStartBulkCalling: () => void;
  onAssign: () => void;
  onBulkDelete?: () => void;
  onClearSelection: () => void;
  canBulkDelete?: boolean;
}

export function CandidateSelectionBar({
  selectedCount,
  onStartBulkCalling,
  onAssign,
  onBulkDelete,
  onClearSelection,
  canBulkDelete = false,
}: CandidateSelectionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-center gap-3 bg-card border shadow-lg rounded-lg px-4 py-3">
        <span className="text-sm font-medium text-muted-foreground">
          {selectedCount} candidate{selectedCount !== 1 ? 's' : ''} selected
        </span>
        
        <div className="h-4 w-px bg-border" />
        
        <Button size="sm" onClick={onStartBulkCalling}>
          <Phone className="h-4 w-4 mr-2" />
          Start Bulk Calling
        </Button>
        
        <Button size="sm" variant="outline" onClick={onAssign}>
          <UserPlus className="h-4 w-4 mr-2" />
          Assign
        </Button>
        
        {canBulkDelete && onBulkDelete && (
          <Button size="sm" variant="destructive" onClick={onBulkDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        )}
        
        <Button size="sm" variant="ghost" onClick={onClearSelection}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
