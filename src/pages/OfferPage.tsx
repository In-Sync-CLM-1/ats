import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { CheckCircle2, XCircle, CalendarDays, IndianRupee, Clock } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInCalendarDays } from "date-fns";

interface OfferView {
  first_name: string;
  job_title: string;
  company_name: string | null;
  ctc_lakhs: number;
  joining_date: string;
  expiry_date: string;
  status: string;
  notes: string | null;
  decided_at: string | null;
}

export default function OfferPage() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [declineMode, setDeclineMode] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: offer, isLoading, error } = useQuery({
    queryKey: ["offer", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_offer", { p_token: token! });
      if (error) throw error;
      return data as unknown as OfferView;
    },
    enabled: !!token,
  });

  const respond = async (decision: "accepted" | "declined") => {
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("respond_to_offer", {
        p_token: token!,
        p_decision: decision,
        p_reason: decision === "declined" ? reason || null : null,
      });
      if (error) throw error;
      toast.success(decision === "accepted" ? "Congratulations — offer accepted!" : "Response recorded");
      await queryClient.invalidateQueries({ queryKey: ["offer", token] });
    } catch (e: any) {
      toast.error(e.message || "Could not record your response");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><LoadingSpinner /></div>;
  }
  if (error || !offer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-muted-foreground">This offer link is invalid. Please contact your recruiter.</p>
      </div>
    );
  }

  const daysLeft = differenceInCalendarDays(new Date(offer.expiry_date), new Date());

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-700 via-blue-600 to-slate-100 flex items-start justify-center px-4 pt-16 pb-10">
      <Card className="w-full max-w-xl shadow-2xl">
        <CardContent className="pt-8 pb-8 px-8">
          <p className="text-sm font-semibold tracking-wide uppercase text-blue-600 mb-1">Offer of Employment</p>
          <h1 className="text-2xl font-bold">Hi {offer.first_name},</h1>
          <p className="text-muted-foreground mt-2">
            {offer.company_name ?? "We"} would like to offer you the position of{" "}
            <span className="font-semibold text-foreground">{offer.job_title}</span>.
          </p>

          <div className="grid sm:grid-cols-3 gap-3 mt-6">
            <div className="border rounded-lg p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><IndianRupee className="h-3 w-3" />Annual CTC</p>
              <p className="text-lg font-bold">₹{Number(offer.ctc_lakhs).toFixed(1)}L</p>
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3 w-3" />Joining Date</p>
              <p className="text-lg font-bold">{format(new Date(offer.joining_date), "dd MMM yyyy")}</p>
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Valid Till</p>
              <p className="text-lg font-bold">{format(new Date(offer.expiry_date), "dd MMM")}</p>
              {offer.status === "sent" && daysLeft >= 0 && (
                <p className="text-xs text-amber-600">{daysLeft === 0 ? "expires today" : `${daysLeft} day(s) left`}</p>
              )}
            </div>
          </div>

          {offer.notes && (
            <p className="text-sm text-muted-foreground mt-4 border-l-2 border-blue-300 pl-3">{offer.notes}</p>
          )}

          {offer.status === "sent" ? (
            <div className="mt-8 space-y-3">
              {!declineMode ? (
                <div className="flex flex-wrap gap-3">
                  <Button
                    size="lg"
                    className="bg-green-600 hover:bg-green-700 text-white flex-1"
                    disabled={submitting}
                    onClick={() => respond("accepted")}
                  >
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Accept Offer
                  </Button>
                  <Button size="lg" variant="outline" disabled={submitting} onClick={() => setDeclineMode(true)}>
                    <XCircle className="h-5 w-5 mr-2" />
                    Decline
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Help us understand — what made you decline? (optional)"
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button variant="destructive" disabled={submitting} onClick={() => respond("declined")}>
                      Confirm Decline
                    </Button>
                    <Button variant="ghost" onClick={() => setDeclineMode(false)}>Back</Button>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Your response is recorded instantly and your recruiter is notified.
              </p>
            </div>
          ) : (
            <div className="mt-8 border rounded-lg p-4 bg-slate-50">
              {offer.status === "accepted" ? (
                <p className="flex items-center gap-2 text-green-700 font-semibold">
                  <CheckCircle2 className="h-5 w-5" />
                  Offer accepted{offer.decided_at ? ` on ${format(new Date(offer.decided_at), "dd MMM yyyy")}` : ""} — welcome aboard! Your onboarding link is on its way.
                </p>
              ) : offer.status === "declined" ? (
                <p className="flex items-center gap-2 text-red-700 font-semibold">
                  <XCircle className="h-5 w-5" />
                  You declined this offer{offer.decided_at ? ` on ${format(new Date(offer.decided_at), "dd MMM yyyy")}` : ""}.
                </p>
              ) : (
                <p className="flex items-center gap-2 text-slate-700 font-semibold">
                  <Clock className="h-5 w-5" />
                  This offer has {offer.status === "expired" ? "expired" : "been withdrawn"} — please contact your recruiter.
                </p>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center mt-8">Powered by In-Sync ATS</p>
        </CardContent>
      </Card>
    </div>
  );
}
