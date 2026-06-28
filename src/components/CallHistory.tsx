import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Phone, PlayCircle, Search, FileText, Plus, Edit2, BrainCircuit, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CallDispositionDialog } from "./CallDispositionDialog";

interface CallHistoryProps {
  candidateId?: string;
  limit?: number;
  showFilters?: boolean;
}

interface CallLog {
  id: string;
  call_sid: string;
  candidate_id: string | null;
  initiated_by: string | null;
  from_number: string;
  to_number: string;
  status: string;
  call_method: string | null;
  conversation_duration: number;
  recording_url: string | null;
  transcript: string | null;
  analysis_json: Record<string, any> | null;
  analysis_quality_score: number | null;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  disposition: string | null;
  subdisposition: string | null;
  notes: string | null;
  disposition_set_by: string | null;
  disposition_set_at: string | null;
  candidate?: {
    first_name: string;
    last_name: string;
    phone: string;
  };
  initiated_by_profile?: {
    full_name: string;
    email: string;
  };
}

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'completed':
      return 'default';
    case 'no-answer':
    case 'busy':
      return 'secondary';
    case 'failed':
    case 'canceled':
      return 'destructive';
    case 'initiated':
    case 'ringing':
    case 'in-progress':
      return 'outline';
    default:
      return 'outline';
  }
};

const formatDuration = (seconds: number) => {
  if (seconds === 0) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export function CallHistory({ candidateId, limit = 50, showFilters = true }: CallHistoryProps) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dispositionDialogOpen, setDispositionDialogOpen] = useState(false);
  const [selectedCallLog, setSelectedCallLog] = useState<CallLog | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null);

  const { data: callLogs, isLoading, refetch } = useQuery({
    queryKey: ['call-logs', candidateId, statusFilter, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('call_logs')
        .select(`
          *,
          candidate:candidate_id (
            first_name,
            last_name,
            phone
          ),
          initiated_by_profile:profiles!call_logs_initiated_by_fkey (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (candidateId) {
        query = query.eq('candidate_id', candidateId);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (searchQuery) {
        query = query.or(`to_number.ilike.%${searchQuery}%,from_number.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching call logs:', error);
        throw error;
      }

      return data as CallLog[];
    },
  });

  const analyzeRecording = async (callLogId: string) => {
    setAnalyzingId(callLogId);
    try {
      const resp = await supabase.functions.invoke("analyze-call-recording", {
        body: { call_log_id: callLogId },
      });
      if (resp.error) throw resp.error;
      if (resp.data?.error) throw new Error(resp.data.error);
      await refetch();
      setExpandedAnalysis(callLogId);
      toast.success("Call analysis complete");
    } catch (err: any) {
      toast.error(err.message || "Analysis failed");
    } finally {
      setAnalyzingId(null);
    }
  };

  // Real-time subscription for call logs
  useEffect(() => {
    const channel = supabase
      .channel('call-logs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_logs',
          ...(candidateId && { filter: `candidate_id=eq.${candidateId}` }),
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [candidateId, refetch]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading call history...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showFilters && (
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by phone number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="no-answer">No Answer</SelectItem>
              <SelectItem value="busy">Busy</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="initiated">Initiated</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {!callLogs || callLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 border rounded-lg">
          <Phone className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No call history yet</p>
          <p className="text-sm text-muted-foreground">Call logs will appear here once you make calls</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                {!candidateId && <TableHead>Contact</TableHead>}
                <TableHead>Phone Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Disposition</TableHead>
                <TableHead>Initiated By</TableHead>
                <TableHead>Recording / AI</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {callLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">
                    {log.created_at && format(new Date(log.created_at), 'MMM dd, yyyy HH:mm')}
                  </TableCell>
                  {!candidateId && (
                    <TableCell>
                      {log.candidate ? `${log.candidate.first_name} ${log.candidate.last_name}` : '-'}
                    </TableCell>
                  )}
                  <TableCell className="font-mono text-sm">{log.to_number}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(log.status)}>
                      {log.status.replace('-', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDuration(log.conversation_duration)}</TableCell>
                  <TableCell>
                    {log.disposition ? (
                      <div className="space-y-1">
                        <Badge variant="default">{log.disposition}</Badge>
                        {log.subdisposition && (
                          <div className="text-xs text-muted-foreground">{log.subdisposition}</div>
                        )}
                        {log.notes && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 px-2">
                                <FileText className="h-3 w-3" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80">
                              <div className="space-y-2">
                                <h4 className="font-medium text-sm">Notes</h4>
                                <p className="text-sm text-muted-foreground">{log.notes}</p>
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {log.initiated_by_profile?.full_name || log.initiated_by_profile?.email || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        {log.recording_url ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(log.recording_url!, '_blank')}
                            title="Play recording"
                          >
                            <PlayCircle className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                        {(log.recording_url || log.transcript) && !log.analysis_json && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={analyzingId === log.id}
                            onClick={() => analyzeRecording(log.id)}
                            title="Analyse with AI"
                          >
                            {analyzingId === log.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <BrainCircuit className="h-4 w-4 text-purple-500" />
                            }
                          </Button>
                        )}
                        {log.analysis_json && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedAnalysis(expandedAnalysis === log.id ? null : log.id)}
                            title="View AI analysis"
                          >
                            <BrainCircuit className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                      </div>
                      {expandedAnalysis === log.id && log.analysis_json && (
                        <div className="text-xs bg-muted/60 rounded p-2 space-y-1 max-w-xs">
                          {log.analysis_json.summary && (
                            <p className="text-muted-foreground italic">{log.analysis_json.summary}</p>
                          )}
                          {log.analysis_json.next_step && (
                            <p><span className="font-medium">Next:</span> {log.analysis_json.next_step}</p>
                          )}
                          {log.analysis_json.interest_level && (
                            <p><span className="font-medium">Interest:</span> {log.analysis_json.interest_level}</p>
                          )}
                          {log.analysis_quality_score != null && (
                            <p><span className="font-medium">Quality:</span> {log.analysis_quality_score}/100</p>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {log.disposition ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedCallLog(log);
                          setDispositionDialogOpen(true);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedCallLog(log);
                          setDispositionDialogOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {selectedCallLog && (
        <CallDispositionDialog
          open={dispositionDialogOpen}
          onOpenChange={setDispositionDialogOpen}
          callLogId={selectedCallLog.id}
          existingDisposition={{
            disposition: selectedCallLog.disposition,
            subdisposition: selectedCallLog.subdisposition,
            notes: selectedCallLog.notes,
          }}
        />
      )}
    </div>
  );
}