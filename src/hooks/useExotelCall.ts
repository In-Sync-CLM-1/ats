import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type CallStatus = "idle" | "initiating" | "ringing" | "in-progress" | "completed" | "failed" | "no-answer" | "busy";

interface CallLogUpdate {
  status: string;
  start_time?: string;
  end_time?: string;
  conversation_duration?: number;
}

export const useExotelCall = () => {
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [callSid, setCallSid] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Start duration timer
  const startTimer = () => {
    setCallDuration(0);
    intervalRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  // Stop duration timer
  const stopTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Subscribe to call_logs updates
  useEffect(() => {
    if (!callSid) return;

    const channel = supabase
      .channel(`call-log-${callSid}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "call_logs",
          filter: `call_sid=eq.${callSid}`,
        },
        (payload) => {
          const update = payload.new as CallLogUpdate;
          console.log("Call log update:", update);

          if (update.status === "ringing") {
            setCallStatus("ringing");
          } else if (update.status === "in-progress") {
            setCallStatus("in-progress");
            startTimer();
          } else if (update.status === "completed" || update.status === "no-answer" || update.status === "busy" || update.status === "failed") {
            setCallStatus(update.status as CallStatus);
            stopTimer();
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      stopTimer();
    };
  }, [callSid]);

  // Initiate call
  const initiateCall = async (toNumber: string, candidateId: string, fromNumber?: string) => {
    try {
      setIsLoading(true);
      setCallStatus("initiating");

      const { data, error } = await supabase.functions.invoke("exotel-make-call", {
        body: {
          to_number: toNumber,
          candidate_id: candidateId,
          from_number: fromNumber,
        },
      });

      if (error) throw error;

      if (data?.call?.Call?.Sid || data?.call?.Sid) {
        const sid = data.call.Call?.Sid || data.call.Sid;
        setCallSid(sid);
        setCallStatus("ringing");
        toast.success("Call initiated successfully");
        return sid;
      } else {
        throw new Error("No call SID returned");
      }
    } catch (error: any) {
      console.error("Error initiating call:", error);
      toast.error(error.message || "Failed to initiate call");
      setCallStatus("failed");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // End call (mark as completed)
  const endCall = async (disposition?: string, subdisposition?: string, notes?: string, nextCallDate?: string) => {
    if (!callSid) return;

    try {
      const { error } = await supabase
        .from("call_logs")
        .update({
          status: "completed",
          end_time: new Date().toISOString(),
          disposition: disposition || null,
          subdisposition: subdisposition || null,
          notes: notes || null,
          disposition_set_at: disposition ? new Date().toISOString() : null,
        })
        .eq("call_sid", callSid);

      if (error) throw error;

      setCallStatus("completed");
      stopTimer();
      toast.success("Call ended");
    } catch (error: any) {
      console.error("Error ending call:", error);
      toast.error("Failed to end call");
    }
  };

  // Reset call state
  const resetCall = () => {
    setCallStatus("idle");
    setCallSid(null);
    setCallDuration(0);
    stopTimer();
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  };

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return {
    callStatus,
    callSid,
    callDuration,
    isLoading,
    initiateCall,
    endCall,
    resetCall,
    formatDuration,
  };
};
