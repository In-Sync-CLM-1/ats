import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { format } from "date-fns";

interface WhatsAppThreadProps {
  candidateId: string;
  onNewMessage: () => void;
}

export function WhatsAppThread({ candidateId, onNewMessage }: WhatsAppThreadProps) {
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["whatsapp-thread", candidateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("candidate_id", candidateId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!candidateId,
    refetchInterval: 30000, // replies land without a manual refresh
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground p-4">Loading conversation…</p>;
  }

  return (
    <div className="space-y-4">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-10 border rounded-lg">
          <MessageCircle className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-medium">No WhatsApp conversation yet</p>
          <p className="text-sm text-muted-foreground mb-4">
            Messages you send and the candidate's replies will appear here as one thread.
          </p>
          <Button variant="outline" size="sm" onClick={onNewMessage}>
            <MessageCircle className="h-4 w-4 mr-1" />
            Send WhatsApp
          </Button>
        </div>
      ) : (
        <>
          <div className="border rounded-lg bg-slate-50 p-4 space-y-3 max-h-[480px] overflow-y-auto">
            {messages.map((m: any) => (
              <div key={m.id} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                    m.direction === "outbound"
                      ? "bg-green-600 text-white rounded-br-sm"
                      : "bg-white border rounded-bl-sm"
                  }`}
                >
                  {m.template_name && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] mb-1 ${m.direction === "outbound" ? "border-green-300 text-green-100" : ""}`}
                    >
                      {m.template_name}
                    </Badge>
                  )}
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className={`text-[10px] mt-1 ${m.direction === "outbound" ? "text-green-100" : "text-muted-foreground"}`}>
                    {format(new Date(m.created_at), "dd MMM, h:mm a")}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={onNewMessage}>
            <MessageCircle className="h-4 w-4 mr-1" />
            Send WhatsApp
          </Button>
        </>
      )}
    </div>
  );
}
