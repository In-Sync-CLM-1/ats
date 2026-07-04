import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Share2, Copy, ThumbsUp, ThumbsDown, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ClientShortlistCardProps {
  mandateId: string;
}

const DECISION_CHIP: Record<string, { label: string; className: string; icon: typeof ThumbsUp }> = {
  accepted: { label: "Accepted", className: "bg-green-100 text-green-800 border-green-300", icon: ThumbsUp },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800 border-red-300", icon: ThumbsDown },
  interview: { label: "Interview requested", className: "bg-blue-100 text-blue-800 border-blue-300", icon: CalendarClock },
};

export function ClientShortlistCard({ mandateId }: ClientShortlistCardProps) {
  const queryClient = useQueryClient();

  const { data: mandate } = useQuery({
    queryKey: ["mandate-shortlist-token", mandateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mandates")
        .select("shortlist_token")
        .eq("id", mandateId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!mandateId,
  });

  const { data: feedback = [] } = useQuery({
    queryKey: ["mandate-client-feedback", mandateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mandate_candidates")
        .select("candidate_id, client_decision, client_comment, client_decided_at, candidates(first_name, last_name)")
        .eq("mandate_id", mandateId)
        .not("client_decision", "is", null)
        .order("client_decided_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!mandateId,
  });

  const shortlistUrl = mandate?.shortlist_token
    ? `${window.location.origin}/shortlist/${mandate.shortlist_token}`
    : null;

  const generateLink = async () => {
    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
    const { error } = await supabase
      .from("mandates")
      .update({ shortlist_token: token })
      .eq("id", mandateId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["mandate-shortlist-token", mandateId] });
    toast.success("Client shortlist link generated");
  };

  const copyLink = () => {
    if (!shortlistUrl) return;
    navigator.clipboard.writeText(shortlistUrl);
    toast.success("Shortlist link copied — share it with the client");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Share2 className="h-5 w-5 text-blue-600" />
          Client Shortlist
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Share the submitted candidates with the client — they review profiles (contact details
          hidden) and mark each one accepted, rejected, or interview. Feedback lands here and
          notifies the recruiter instantly.
        </p>

        {shortlistUrl ? (
          <div className="flex items-center gap-2">
            <code className="text-xs bg-muted px-2 py-1.5 rounded flex-1 truncate">{shortlistUrl}</code>
            <Button variant="outline" size="sm" onClick={copyLink}>
              <Copy className="h-4 w-4 mr-1" />
              Copy Link
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={generateLink}>
            <Share2 className="h-4 w-4 mr-1" />
            Generate Client Link
          </Button>
        )}

        {feedback.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Client feedback ({feedback.length})</p>
            {feedback.map((f: any) => {
              const chip = DECISION_CHIP[f.client_decision];
              const Icon = chip?.icon ?? ThumbsUp;
              return (
                <div key={f.candidate_id} className="flex items-start justify-between gap-3 border rounded-md p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {f.candidates?.first_name} {f.candidates?.last_name}
                    </p>
                    {f.client_comment && (
                      <p className="text-xs text-muted-foreground mt-0.5">"{f.client_comment}"</p>
                    )}
                    {f.client_decided_at && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(f.client_decided_at), "dd MMM yyyy, h:mm a")}
                      </p>
                    )}
                  </div>
                  {chip && (
                    <Badge variant="outline" className={`${chip.className} flex-none gap-1`}>
                      <Icon className="h-3 w-3" />
                      {chip.label}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
