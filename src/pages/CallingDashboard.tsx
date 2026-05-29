import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { CallKPICards } from "@/components/calling/CallKPICards";
import { CallHistory } from "@/components/CallHistory";
import { BulkCallingQueue } from "@/components/calling/BulkCallingQueue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { History, ArrowLeft } from "lucide-react";

export interface BulkCallCandidate {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  designation?: string | null;
  current_company?: string | null;
  position_applied_for?: string;
}

interface LocationState {
  candidates?: BulkCallCandidate[];
}

export default function CallingDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [refreshKey, setRefreshKey] = useState(0);
  const [bulkCandidates, setBulkCandidates] = useState<BulkCallCandidate[]>([]);
  const [isBulkCallingMode, setIsBulkCallingMode] = useState(false);

  // Check for candidates passed via navigation state
  useEffect(() => {
    const state = location.state as LocationState;
    if (state?.candidates && state.candidates.length > 0) {
      setBulkCandidates(state.candidates);
      setIsBulkCallingMode(true);
      // Clear the state so refreshing doesn't restart the session
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleBulkCallingComplete = () => {
    setIsBulkCallingMode(false);
    setBulkCandidates([]);
    setRefreshKey(prev => prev + 1);
  };

  // Bulk calling mode UI
  if (isBulkCallingMode) {
    return (
      <div className="px-8 py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={handleBulkCallingComplete}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Bulk Calling Session</h1>
            <p className="text-muted-foreground mt-1">
              Making calls to {bulkCandidates.length} candidates
            </p>
          </div>
        </div>

        <BulkCallingQueue
          candidates={bulkCandidates}
          onComplete={handleBulkCallingComplete}
        />
      </div>
    );
  }

  return (
    <div className="px-8 py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Calling Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your calls, track performance, and stay organized
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/call-dispositions")}>
            <History className="mr-2 h-4 w-4" />
            Call Dispositions
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <CallKPICards key={refreshKey} />

      {/* Recent Call Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Recent Call Activity
            </span>
            <span className="text-sm text-muted-foreground font-normal">
              Live updates enabled
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CallHistory 
            key={refreshKey}
            limit={20} 
            showFilters={true}
          />
        </CardContent>
      </Card>
    </div>
  );
}
