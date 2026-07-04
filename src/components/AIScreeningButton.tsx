import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, PhoneCall, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AIScreeningButtonProps {
  candidateId: string;
  candidateName: string;
  candidatePhone?: string | null;
  onCallStarted?: (callLogId: string) => void;
}

type ScreenState = "idle" | "dialing" | "completed" | "failed";

export function AIScreeningButton({ candidateId, candidateName, candidatePhone, onCallStarted }: AIScreeningButtonProps) {
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
      <div className="flex items-center gap-4 rounded-xl border border-purple-200 bg-purple-50/60 px-5 py-4 max-w-md">
        <div className="relative flex h-14 w-14 items-center justify-center flex-none">
          <span className="absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-30 animate-ping" />
          <span className="absolute inline-flex h-10 w-10 rounded-full bg-purple-400 opacity-40 animate-pulse" />
          <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-purple-600 text-white">
            <PhoneCall className="h-4 w-4" />
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-purple-900 flex items-center gap-2">
            Dialing {candidateName}
            <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-500" />
          </p>
          {candidatePhone && (
            <p className="text-sm font-mono text-purple-700">+91 {candidatePhone}</p>
          )}
          <p className="text-xs text-purple-600 mt-0.5 flex items-center gap-1">
            <Bot className="h-3 w-3" />
            AI voice agent · outcome logs to Call History automatically
          </p>
        </div>
      </div>
    );
  }

  if (state === "completed") {
    return (
      <div className="flex items-center gap-4 rounded-xl border border-green-200 bg-green-50/60 px-5 py-4 max-w-md">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-green-600 text-white">
          <CheckCircle className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-green-900">AI Call Initiated — {candidateName} on the line</p>
          <p className="text-xs text-green-700 mt-0.5">
            Transcript, summary, and outcome will appear in Call History when the call ends.
            {executionId && <span className="font-mono text-green-600"> · {executionId.slice(0, 12)}…</span>}
          </p>
          <Button variant="ghost" size="sm" onClick={reset} className="text-xs h-6 mt-1 -ml-2 text-green-700">
            <PhoneCall className="h-3 w-3 mr-1" />
            Call Again
          </Button>
        </div>
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
