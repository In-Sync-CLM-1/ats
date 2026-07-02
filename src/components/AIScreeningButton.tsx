import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, PhoneCall, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AIScreeningButtonProps {
  candidateId: string;
  candidateName: string;
  onCallStarted?: (callLogId: string) => void;
}

type ScreenState = "idle" | "dialing" | "completed" | "failed";

export function AIScreeningButton({ candidateId, candidateName, onCallStarted }: AIScreeningButtonProps) {
  const [state, setState] = useState<ScreenState>("idle");
  const [executionId, setExecutionId] = useState<string | null>(null);

  const startScreening = async () => {
    setState("dialing");
    try {
      const resp = await supabase.functions.invoke("ai-screen-candidate", {
        body: { candidate_id: candidateId },
      });
      if (resp.error) throw resp.error;
      const data = resp.data;
      if (data?.error) throw new Error(data.error);

      setExecutionId(data.execution_id);
      setState("completed");
      toast.success(`AI call initiated to ${candidateName}`);
      if (onCallStarted && data.call_log_id) onCallStarted(data.call_log_id);
    } catch (err: any) {
      setState("failed");
      toast.error(err.message || "Failed to start AI call");
    }
  };

  const reset = () => {
    setState("idle");
    setExecutionId(null);
  };

  if (state === "idle") {
    return (
      <Button variant="outline" className="gap-2 border-purple-300 text-purple-700 hover:bg-purple-50" onClick={startScreening}>
        <Bot className="h-4 w-4" />
        Start AI Call
      </Button>
    );
  }

  if (state === "dialing") {
    return (
      <Button variant="outline" disabled className="gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Dialing…
      </Button>
    );
  }

  if (state === "completed") {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="gap-1 text-green-700 border-green-300">
          <CheckCircle className="h-3 w-3" />
          AI Call Initiated
        </Badge>
        {executionId && (
          <span className="text-xs text-muted-foreground font-mono">
            {executionId.slice(0, 12)}…
          </span>
        )}
        <Button variant="ghost" size="sm" onClick={reset} className="text-xs h-7">
          <PhoneCall className="h-3 w-3 mr-1" />
          Call Again
        </Button>
      </div>
    );
  }

  // failed
  return (
    <div className="flex items-center gap-2">
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" />
        Call Failed
      </Badge>
      <Button variant="ghost" size="sm" onClick={reset} className="text-xs h-7">
        Retry
      </Button>
    </div>
  );
}
