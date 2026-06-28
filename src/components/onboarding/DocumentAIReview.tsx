import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, XCircle, Shield } from "lucide-react";

interface Finding {
  category: string;
  severity: "low" | "medium" | "high";
  description: string;
}

interface AIAnalysis {
  risk_score: number;
  findings: Finding[];
  recommendation: "approve" | "review" | "reject";
  summary: string;
}

interface DocumentAIReviewProps {
  analysis: AIAnalysis | null;
}

export function DocumentAIReview({ analysis }: DocumentAIReviewProps) {
  if (!analysis) return null;

  const riskColor = analysis.risk_score <= 30 ? "text-green-600" : analysis.risk_score <= 60 ? "text-yellow-600" : "text-red-600";
  const riskBg   = analysis.risk_score <= 30 ? "bg-green-100"  : analysis.risk_score <= 60 ? "bg-yellow-100"  : "bg-red-100";

  const recBadge = {
    approve: <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Approve</Badge>,
    review:  <Badge className="bg-yellow-100 text-yellow-800"><AlertTriangle className="h-3 w-3 mr-1" />Needs Review</Badge>,
    reject:  <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Reject</Badge>,
  }[analysis.recommendation] ?? null;

  const severityStyle = (s: string) =>
    s === "high" ? "border-red-200 bg-red-50" : s === "medium" ? "border-yellow-200 bg-yellow-50" : "border-green-200 bg-green-50";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4" />
          AI Document Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`${riskBg} rounded-full w-12 h-12 flex items-center justify-center`}>
              <span className={`text-lg font-bold ${riskColor}`}>{analysis.risk_score}</span>
            </div>
            <div>
              <p className="text-sm font-medium">Risk Score</p>
              <p className="text-xs text-muted-foreground">out of 100</p>
            </div>
          </div>
          {recBadge}
        </div>

        <p className="text-sm text-muted-foreground">{analysis.summary}</p>

        {analysis.findings.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Findings</p>
            {analysis.findings.map((f, i) => (
              <div key={i} className={`border rounded-md p-3 ${severityStyle(f.severity)}`}>
                <div className="flex justify-between items-start">
                  <span className="text-sm font-medium">{f.category}</span>
                  <Badge variant="outline" className="text-xs capitalize">{f.severity}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{f.description}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
