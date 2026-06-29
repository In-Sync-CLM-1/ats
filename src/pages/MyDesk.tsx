import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Phone, MessageCircle, Eye, Calendar, Users, TrendingUp, Clock } from "lucide-react";
import { format, isToday, isPast, parseISO } from "date-fns";
import { ExotelCallDialog } from "@/components/ExotelCallDialog";
import { WhatsAppDialog } from "@/components/WhatsAppDialog";

interface DeskCandidate {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  interview_stage: string | null;
  current_status: string;
  position_applied_for: string | null;
  source: string | null;
  next_call_date: string | null;
  latest_disposition: string | null;
  current_ctc_lakhs: number | null;
  expected_ctc_lakhs: number | null;
  notice_period_days: number | null;
  created_at: string;
}

const STAGE_ORDER: Record<string, number> = {
  offer: 0, interview: 1, shortlisted: 2, screening: 3, applied: 4,
};

const STAGE_COLORS: Record<string, string> = {
  selected: "bg-green-100 text-green-800",
  offer: "bg-purple-100 text-purple-800",
  interview: "bg-blue-100 text-blue-800",
  shortlisted: "bg-indigo-100 text-indigo-800",
  screening: "bg-yellow-100 text-yellow-800",
  applied: "bg-gray-100 text-gray-700",
};

function priorityGroup(c: DeskCandidate): "today" | "active" | "pipeline" {
  if (c.next_call_date) {
    const d = parseISO(c.next_call_date);
    if (isToday(d) || isPast(d)) return "today";
  }
  const stage = (c.interview_stage || "").toLowerCase();
  if (["offer", "interview", "shortlisted"].includes(stage)) return "active";
  return "pipeline";
}

export default function MyDesk() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [callCandidate, setCallCandidate] = useState<DeskCandidate | null>(null);
  const [whatsappCandidate, setWhatsappCandidate] = useState<DeskCandidate | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
        setUserName(session.user.user_metadata?.full_name || session.user.email || "You");
      }
    });
  }, []);

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["my-desk", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("id,first_name,last_name,phone,email,interview_stage,current_status,position_applied_for,source,next_call_date,latest_disposition,current_ctc_lakhs,expected_ctc_lakhs,notice_period_days,created_at")
        .eq("assigned_recruiter", userId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as DeskCandidate[];
    },
  });

  if (isLoading || !userId) return <LoadingSpinner />;

  const today = candidates.filter(c => priorityGroup(c) === "today");
  const active = candidates.filter(c => priorityGroup(c) === "active").sort(
    (a, b) => (STAGE_ORDER[a.interview_stage?.toLowerCase() || ""] ?? 5) - (STAGE_ORDER[b.interview_stage?.toLowerCase() || ""] ?? 5)
  );
  const pipeline = candidates.filter(c => priorityGroup(c) === "pipeline");

  const stats = [
    { label: "Assigned", value: candidates.length, icon: Users, color: "text-blue-600" },
    { label: "Action Today", value: today.length, icon: Clock, color: "text-red-600" },
    { label: "In Interview", value: candidates.filter(c => (c.interview_stage || "").toLowerCase() === "interview").length, icon: TrendingUp, color: "text-purple-600" },
    { label: "Offers Out", value: candidates.filter(c => (c.interview_stage || "").toLowerCase() === "offer").length, icon: Calendar, color: "text-green-600" },
  ];

  const CandidateRow = ({ c }: { c: DeskCandidate }) => (
    <div className="flex items-center gap-4 py-3 px-4 hover:bg-gray-50 rounded-lg transition-colors group">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
        {c.first_name[0]}{c.last_name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 text-sm">
            {c.first_name} {c.last_name}
          </span>
          {c.interview_stage && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STAGE_COLORS[c.interview_stage.toLowerCase()] || "bg-gray-100 text-gray-700"}`}>
              {c.interview_stage}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {c.position_applied_for && (
            <span className="text-xs text-gray-500 truncate max-w-[180px]">{c.position_applied_for}</span>
          )}
          {c.expected_ctc_lakhs && (
            <span className="text-xs text-gray-400">Exp ₹{c.expected_ctc_lakhs}L</span>
          )}
          {c.notice_period_days && (
            <span className="text-xs text-gray-400">{c.notice_period_days}d notice</span>
          )}
          {c.next_call_date && (
            <span className={`text-xs font-medium ${isPast(parseISO(c.next_call_date)) && !isToday(parseISO(c.next_call_date)) ? "text-red-500" : "text-orange-500"}`}>
              Call {isToday(parseISO(c.next_call_date)) ? "today" : format(parseISO(c.next_call_date), "dd MMM")}
            </span>
          )}
          {c.latest_disposition && (
            <span className="text-xs text-gray-400 italic">{c.latest_disposition}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {c.phone && (
          <Button size="icon" variant="ghost" className="h-7 w-7" title="Call" onClick={() => setCallCandidate(c)}>
            <Phone className="w-3.5 h-3.5 text-green-600" />
          </Button>
        )}
        {c.phone && (
          <Button size="icon" variant="ghost" className="h-7 w-7" title="WhatsApp" onClick={() => setWhatsappCandidate(c)}>
            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
          </Button>
        )}
        <Button size="icon" variant="ghost" className="h-7 w-7" title="View Profile" onClick={() => navigate(`/candidates/view/${c.id}`)}>
          <Eye className="w-3.5 h-3.5 text-blue-600" />
        </Button>
      </div>
    </div>
  );

  const Section = ({ title, items, accent }: { title: string; items: DeskCandidate[]; accent?: string }) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 px-1">
          <h2 className={`text-xs font-semibold uppercase tracking-wider ${accent || "text-gray-500"}`}>{title}</h2>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${accent ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>{items.length}</span>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-50">
          {items.map(c => <CandidateRow key={c.id} c={c} />)}
        </div>
      </div>
    );
  };

  return (
    <div className="px-8 py-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">My Desk</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{userName}'s assigned candidates</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map(s => (
          <Card key={s.label} className="border-gray-100">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {candidates.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No candidates assigned yet</p>
          <p className="text-sm mt-1">Candidates assigned to you will appear here.</p>
        </div>
      ) : (
        <>
          <Section title="Action Today" items={today} accent="text-red-600" />
          <Section title="Active Pipeline" items={active} />
          <Section title="Newly Added" items={pipeline} />
        </>
      )}

      {callCandidate && (
        <ExotelCallDialog
          open={!!callCandidate}
          onOpenChange={v => !v && setCallCandidate(null)}
          candidateData={{ id: callCandidate.id, first_name: callCandidate.first_name, last_name: callCandidate.last_name, phone: callCandidate.phone || "" }}
        />
      )}
      {whatsappCandidate && (
        <WhatsAppDialog
          open={!!whatsappCandidate}
          onOpenChange={v => !v && setWhatsappCandidate(null)}
          candidateData={{ id: whatsappCandidate.id, first_name: whatsappCandidate.first_name, last_name: whatsappCandidate.last_name, phone: whatsappCandidate.phone || "" }}
        />
      )}
    </div>
  );
}
