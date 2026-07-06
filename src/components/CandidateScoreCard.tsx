import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface CandidateScoreCardProps {
  candidateId: string;
}

const CATEGORY_CONFIG: Record<string, { label: string; className: string }> = {
  hire:        { label: "Hire",        className: "bg-green-600 text-white" },
  strong:      { label: "Strong",      className: "bg-blue-600 text-white" },
  promising:   { label: "Promising",   className: "bg-amber-500 text-white" },
  weak:        { label: "Weak",        className: "bg-orange-500 text-white" },
  unqualified: { label: "Unqualified", className: "bg-red-600 text-white" },
};

const BREAKDOWN_COLORS: Record<string, string> = {
  "Interview Stage":    "[&>div]:bg-purple-500",
  "Call Engagement":    "[&>div]:bg-blue-500",
  "Profile Completeness": "[&>div]:bg-green-500",
  "Application Quality":  "[&>div]:bg-amber-500",
};

const BREAKDOWN_MAX: Record<string, number> = {
  "Interview Stage":    45,
  "Call Engagement":    25,
  "Profile Completeness": 20,
  "Application Quality":  10,
};

// Older scores stored raw snake_case keys — always render human labels.
const humanizeKey = (key: string) =>
  key.includes("_") || key === key.toLowerCase()
    ? key.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    : key;

export function CandidateScoreCard({ candidateId }: CandidateScoreCardProps) {
  const queryClient = useQueryClient();
  const [scoring, setScoring] = useState(false);

  const { data: score, isLoading } = useQuery({
    queryKey: ["candidate-ai-score", candidateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidate_ai_scores")
        .select("*")
        .eq("candidate_id", candidateId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!candidateId,
  });

  const runScore = async (force = false) => {
    setScoring(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const resp = await supabase.functions.invoke("candidate-score", {
        body: { candidate_id: candidateId, force },
      });
      if (resp.error) throw resp.error;
      await queryClient.invalidateQueries({ queryKey: ["candidate-ai-score", candidateId] });
      toast.success(resp.data?.cached ? "Score is up to date" : "AI score updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to score candidate");
    } finally {
      setScoring(false);
    }
  };

  const cat = score ? CATEGORY_CONFIG[score.category] : null;
  const breakdown = score?.breakdown as Record<string, number> | null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-purple-500" />
            AI Candidate Score
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => runScore(!score)}
            disabled={scoring || isLoading}
            title={score ? "Refresh score" : "Score now"}
          >
            <RefreshCw className={`h-4 w-4 ${scoring ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
            Loading…
          </div>
        )}

        {!isLoading && !score && (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-3">
            <Sparkles className="h-10 w-10 opacity-30" />
            <p>No AI score yet.</p>
            <Button size="sm" onClick={() => runScore(false)} disabled={scoring}>
              {scoring ? "Scoring…" : "Generate Score"}
            </Button>
          </div>
        )}

        {!isLoading && score && cat && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{score.score}</span>
                <span className="text-sm text-muted-foreground">/ 100</span>
              </div>
              <Badge className={cat.className}>{cat.label}</Badge>
            </div>

            <Progress value={score.score} className="h-2" />

            {breakdown && (
              <div className="space-y-1.5">
                {Object.entries(breakdown).map(([key, val]) => {
                  const label = humanizeKey(key);
                  const max = BREAKDOWN_MAX[label] ?? 100;
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
                        <span>{label}</span>
                        <span>{val} / {max}</span>
                      </div>
                      <Progress
                        value={(val / max) * 100}
                        className={`h-1.5 ${BREAKDOWN_COLORS[label] || "[&>div]:bg-primary"}`}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {score.reasoning && (
              <p className="text-xs text-muted-foreground border-l-2 border-purple-300 pl-2 italic">
                {score.reasoning}
              </p>
            )}

            <p className="text-xs text-muted-foreground text-right">
              Scored {format(new Date(score.scored_at), "dd MMM yyyy, h:mm a")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
