import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileSignature, Copy, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";

interface OfferCardProps {
  candidateId: string;
  defaultCtc?: number | null;
}

const STATUS_CHIP: Record<string, string> = {
  sent: "bg-blue-100 text-blue-800 border-blue-300",
  accepted: "bg-green-100 text-green-800 border-green-300",
  declined: "bg-red-100 text-red-800 border-red-300",
  expired: "bg-slate-100 text-slate-700 border-slate-300",
  withdrawn: "bg-slate-100 text-slate-700 border-slate-300",
};

export function OfferCard({ candidateId, defaultCtc }: OfferCardProps) {
  const { currentOrg } = useOrg();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [ctc, setCtc] = useState(defaultCtc ? String(defaultCtc) : "");
  const [joining, setJoining] = useState(format(addDays(new Date(), 21), "yyyy-MM-dd"));
  const [expiry, setExpiry] = useState(format(addDays(new Date(), 7), "yyyy-MM-dd"));

  const { data: offers = [] } = useQuery({
    queryKey: ["offers", candidateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offers")
        .select("*")
        .eq("candidate_id", candidateId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!candidateId,
  });

  const activeOffer = offers.find((o: any) => o.status === "sent");
  const offerUrl = (token: string) => `${window.location.origin}/offer/${token}`;

  const createOffer = async () => {
    if (!ctc || !joining || !expiry) {
      toast.error("CTC, joining date, and expiry are required");
      return;
    }
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const token = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
      // Attach to the candidate's mandate when there is exactly one active link
      const { data: mc } = await supabase
        .from("mandate_candidates")
        .select("mandate_id")
        .eq("candidate_id", candidateId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      const { error } = await supabase.from("offers").insert({
        org_id: currentOrg!.id,
        candidate_id: candidateId,
        mandate_id: mc?.mandate_id ?? null,
        ctc_lakhs: Number(ctc),
        joining_date: joining,
        expiry_date: expiry,
        token,
        created_by: user?.id,
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["offers", candidateId] });
      setShowForm(false);
      navigator.clipboard.writeText(offerUrl(token));
      toast.success("Offer created — acceptance link copied, share it with the candidate");
    } catch (e: any) {
      toast.error(e.message || "Could not create offer");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileSignature className="h-5 w-5 text-purple-600" />
          Offer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {offers.length === 0 && !showForm && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Issue a formal offer with its own acceptance link — the candidate accepts or declines
              online, the decision is timestamped, and acceptance moves them to Selected automatically.
            </p>
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
              <FileSignature className="h-4 w-4 mr-1" />
              Create Offer
            </Button>
          </div>
        )}

        {showForm && (
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="offer-ctc" className="text-xs">CTC (lakhs / year)</Label>
              <Input id="offer-ctc" type="number" step="0.1" value={ctc} onChange={(e) => setCtc(e.target.value)} placeholder="12.0" />
            </div>
            <div>
              <Label htmlFor="offer-join" className="text-xs">Joining Date</Label>
              <Input id="offer-join" type="date" value={joining} onChange={(e) => setJoining(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="offer-exp" className="text-xs">Offer Valid Till</Label>
              <Input id="offer-exp" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </div>
            <div className="sm:col-span-3 flex gap-2">
              <Button size="sm" onClick={createOffer} disabled={creating}>
                {creating ? "Creating…" : "Create & Copy Link"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {offers.map((o: any) => (
          <div key={o.id} className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm">
                <span className="font-semibold">₹{Number(o.ctc_lakhs).toFixed(1)}L</span>
                <span className="text-muted-foreground"> · joining {format(new Date(o.joining_date), "dd MMM yyyy")} · valid till {format(new Date(o.expiry_date), "dd MMM yyyy")}</span>
              </div>
              <Badge variant="outline" className={`${STATUS_CHIP[o.status] || ""} gap-1 capitalize`}>
                {o.status === "accepted" ? <CheckCircle2 className="h-3 w-3" /> : o.status === "declined" ? <XCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                {o.status}
              </Badge>
            </div>
            {o.decided_at && (
              <p className="text-xs text-muted-foreground">
                {o.status === "accepted" ? "Accepted" : "Declined"} on {format(new Date(o.decided_at), "dd MMM yyyy, h:mm a")}
                {o.decline_reason ? ` — "${o.decline_reason}"` : ""}
              </p>
            )}
            {o.status === "sent" && (
              <div className="flex items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">{offerUrl(o.token)}</code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { navigator.clipboard.writeText(offerUrl(o.token)); toast.success("Offer link copied"); }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        ))}

        {offers.length > 0 && !activeOffer && !showForm && (
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            <FileSignature className="h-4 w-4 mr-1" />
            New Offer
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
